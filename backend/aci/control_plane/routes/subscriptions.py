from typing import Annotated
from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from stripe import StripeClient

from aci.common.db import crud
from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.subscription import (
    DEFAULT_FREE_PLAN_CODE,
    Entitlement,
    StripeWebhookEvent,
    SubscriptionCancellation,
    SubscriptionCheckout,
    SubscriptionPlanPublic,
    SubscriptionPublic,
    SubscriptionRequest,
    SubscriptionResult,
    SubscriptionStatusPublic,
)
from aci.control_plane import access_control, config
from aci.control_plane import dependencies as deps
from aci.control_plane.exceptions import (
    OrganizationNotFound,
    OrganizationSubscriptionNotFound,
    RequestedSubscriptionInvalid,
    StripeOperationError,
)
from aci.control_plane.services.subscription import stripe_event_handler, subscription_service

logger = get_logger(__name__)
router = APIRouter()

stripe_client = StripeClient(config.SUBSCRIPTION_STRIPE_SECRET_KEY)


@router.get("/plans")
async def get_plans(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
) -> list[SubscriptionPlanPublic]:
    return [
        SubscriptionPlanPublic.model_validate(plan, from_attributes=True)
        for plan in crud.subscriptions.get_all_public_plans(db_session=context.db_session)
    ]


@router.get(
    "/organizations/{organization_id}/subscription-status",
    response_model=SubscriptionStatusPublic,
    status_code=status.HTTP_200_OK,
)
async def get_organization_entitlement(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    organization_id: UUID,
) -> SubscriptionStatusPublic:
    access_control.check_act_as_organization_role(
        context.act_as,
        requested_organization_id=organization_id,
        required_role=OrganizationRole.ADMIN,
        throw_error_if_not_permitted=True,
    )

    organization = crud.organizations.get_organization_by_id(
        db_session=context.db_session, organization_id=organization_id
    )
    if organization is None:
        logger.error(f"Organization {organization_id} not found")
        raise OrganizationNotFound()

    entitlement = subscription_service.get_organization_entitlement(
        db_session=context.db_session, organization_id=organization_id
    )

    subscription = organization.subscription
    if subscription is None:
        subscription_public = None
    else:
        subscription_public = SubscriptionPublic(
            plan_code=subscription.subscription_plan.plan_code,
            seat_count=subscription.seat_count,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            cancel_at_period_end=subscription.cancel_at_period_end,
        )

    subscription_status_public = SubscriptionStatusPublic(
        subscription=subscription_public,
        entitlement=entitlement,
    )

    return subscription_status_public


@router.post(
    "/organizations/{organization_id}/change-subscription",
    response_model=SubscriptionCheckout | SubscriptionResult,
    status_code=status.HTTP_200_OK,
)
async def change_organization_subscription(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    organization_id: UUID,
    input: SubscriptionRequest,
) -> SubscriptionCheckout | SubscriptionResult:
    """
    Change the stripe subscription for the organization.
    Use this to change seat count or change plan.
    If the organization does not have a stripe customer id, it will be created.
    Returns the checkout url.
    """
    access_control.check_act_as_organization_role(
        context.act_as,
        requested_organization_id=organization_id,
        required_role=OrganizationRole.ADMIN,
        throw_error_if_not_permitted=True,
    )

    organization = crud.organizations.get_organization_by_id(
        db_session=context.db_session,
        organization_id=organization_id,
    )
    if organization is None:
        logger.error(f"Organization {organization_id} not found")
        raise OrganizationNotFound()

    if input.plan_code == DEFAULT_FREE_PLAN_CODE:
        logger.warning("cannot change subscription to free plan. Use cancel subscription instead.")
        raise RequestedSubscriptionInvalid(
            "cannot change subscription to free plan. Use cancel subscription instead."
        )

    # Check if the plan is active and is available for subscription
    requested_plan = crud.subscriptions.get_active_plan_by_plan_code(
        db_session=context.db_session,
        plan_code=input.plan_code,
    )
    if requested_plan is None or not requested_plan.is_public:
        logger.warning(f"Subscription plan {input.plan_code} not available for subscription")
        raise RequestedSubscriptionInvalid(
            f"subscription plan {input.plan_code} not available for subscription"
        )

    # For paid plans, we require the seat count, and success_url and cancel_url must be provided
    if requested_plan.stripe_price_id is None:
        logger.warning("subscription plan not available for self-served subscription")
        raise RequestedSubscriptionInvalid(
            "subscription plan not available for self-served subscription"
        )

    # Check if the seat_requested matches the plan's requirement
    # plan.min_seat_for_subscription <= requested_seat <= plan.max_seat_for_subscription
    if (
        requested_plan.max_seats_for_subscription is not None
        and input.seat_count > requested_plan.max_seats_for_subscription
    ):
        logger.info(f"requested seat count {input.seat_count} invalid for plan {input.plan_code}")
        raise RequestedSubscriptionInvalid(
            f"requested seat count {input.seat_count} invalid for plan {input.plan_code}"
        )

    # calculate and check entitlement after the change. We reject if the new entitlement
    # does not meet the existing usage.
    entitlement_after_change = Entitlement(
        seat_count=input.seat_count,
        max_custom_mcp_servers=requested_plan.max_custom_mcp_servers,
        log_retention_days=requested_plan.log_retention_days,
    )
    if not subscription_service.is_entitlement_fulfilling_existing_usage(
        db_session=context.db_session,
        organization_id=organization_id,
        entitlement=entitlement_after_change,
    ):
        raise RequestedSubscriptionInvalid(
            "new entitlement does not meet existing usage. Must reduce current usage."
        )

    # Check if the requested subscription is same as the existing one
    if (
        organization.subscription is not None
        and organization.subscription.subscription_plan_id == requested_plan.id
        and organization.subscription.seat_count == input.seat_count
    ):
        logger.warning("the requested subscription is same as the existing one")
        raise RequestedSubscriptionInvalid("the requested subscription is same as the existing one")

    if requested_plan.plan_code == DEFAULT_FREE_PLAN_CODE:
        logger.warning("cannot change subscription to free plan. Use cancel subscription instead.")
        raise RequestedSubscriptionInvalid(
            "cannot change subscription to free plan. Use cancel subscription instead."
        )

    # Execute the subscription change
    result: SubscriptionCheckout | SubscriptionResult

    # Existing: free, Requested: paid (Upgrade from free plan to paid plan)
    if organization.subscription is None:
        result = subscription_service.create_stripe_subscription(
            db_session=context.db_session,
            organization=organization,
            plan=requested_plan,
            seat_count=input.seat_count,
        )
    # Existing: paid, Requested: paid (Change from one paid plan to another, or change seat count)
    else:
        result = subscription_service.update_stripe_subscription(
            db_session=context.db_session,
            organization=organization,
            plan=requested_plan,
            seat_count=input.seat_count,
            existing_subscription=organization.subscription,
        )

    context.db_session.commit()
    return result


@router.post(
    "/stripe/webhook",
    response_model=None,
    status_code=status.HTTP_200_OK,
    description="Stripe webhook for `customer.subscription` events.",
)
async def stripe_webhook(
    request: Request,
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    body: StripeWebhookEvent,
) -> None:
    # Verify webhook signature
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        stripe.Webhook.construct_event(
            payload, sig_header, config.SUBSCRIPTION_STRIPE_WEBHOOK_SECRET
        )  # type: ignore[no-untyped-call]
    except stripe.SignatureVerificationError as e:
        logger.error("Invalid signature")
        raise StripeOperationError("Invalid signature") from e

    if not body.type.startswith("customer.subscription."):
        logger.info(f"Unsupported Stripe event type {body.type}. Ignore.")
        return None

    # Pull the event from stripe instead of directly trusting the payload here.
    stripe_event_handler.handle_stripe_event(
        db_session=db_session,
        event_id=body.id,
    )

    db_session.commit()
    return None


@router.post("/organizations/{organization_id}/cancel-subscription")
async def cancel_organization_subscription(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    organization_id: UUID,
) -> SubscriptionCancellation:
    access_control.check_act_as_organization_role(
        context.act_as,
        requested_organization_id=organization_id,
        required_role=OrganizationRole.ADMIN,
        throw_error_if_not_permitted=True,
    )

    organization = crud.organizations.get_organization_by_id(
        db_session=context.db_session,
        organization_id=organization_id,
    )
    if organization is None:
        logger.error(f"Organization {organization_id} not found")
        raise OrganizationNotFound()

    if organization.subscription is None:
        logger.warning("organization does not have a subscription")
        raise OrganizationSubscriptionNotFound("organization does not have a subscription")

    result = subscription_service.cancel_stripe_subscription(organization.subscription)
    context.db_session.commit()
    return result
