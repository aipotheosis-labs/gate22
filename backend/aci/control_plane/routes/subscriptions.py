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

    # Compute the effective entitlement
    if organization.subscription is None:
        plan = crud.subscriptions.get_free_plan(
            db_session=context.db_session, throw_error_if_not_found=True
        )
    else:
        plan = organization.subscription.plan

    effective_entitlement = subscription_service.compute_effective_entitlement(
        plan=plan,
        seat_count=organization.subscription.seat_count
        if organization.subscription is not None
        else None,
        override=organization.entitlement_override,
    )

    # Construct the output
    subscription_public = (
        SubscriptionPublic.model_validate(organization.subscription, from_attributes=True)
        if organization.subscription is not None
        else None
    )

    subscription_status_public = SubscriptionStatusPublic(
        subscription=subscription_public,
        entitlement=effective_entitlement,
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

    # This is a special case for the free plan, where we auto treat the requested seat count as the
    # max available seats for Free Plan.
    if requested_plan.is_free:
        requested_seat_count = requested_plan.max_seats_for_subscription or 1
    else:
        # For paid plans, we require the seat count, and success_url and cancel_url must be provided
        if input.seat_count is None:
            logger.warning("seat count must be provided")
            raise RequestedSubscriptionInvalid("seat count must be provided")
        if requested_plan.stripe_price_id is None:
            logger.warning("subscription plan not available for self-served subscription")
            raise RequestedSubscriptionInvalid(
                "subscription plan not available for self-served subscription"
            )
        requested_seat_count = input.seat_count

    # Check if the seat_requested matches the plan's requirement
    # plan.min_seat_for_subscription <= requested_seat <= plan.max_seat_for_subscription
    if (
        requested_plan.min_seats_for_subscription is not None
        and requested_seat_count < requested_plan.min_seats_for_subscription
    ) or (
        requested_plan.max_seats_for_subscription is not None
        and requested_seat_count > requested_plan.max_seats_for_subscription
    ):
        logger.info(
            f"requested seat count {requested_seat_count} invalid for plan {input.plan_code}"
        )
        raise RequestedSubscriptionInvalid(
            f"requested seat count {requested_seat_count} invalid for plan {input.plan_code}"
        )

    # calculate and check effective entitlement after the change. We reject if the new entitlement
    # does not meet the existing usage.
    effective_entitlement_after_change = subscription_service.compute_effective_entitlement(
        seat_count=requested_seat_count,
        plan=requested_plan,
        override=organization.entitlement_override,
    )
    if not subscription_service.is_entitlement_fulfilling_existing_usage(
        db_session=context.db_session,
        organization_id=organization_id,
        entitlement=effective_entitlement_after_change,
    ):
        raise RequestedSubscriptionInvalid(
            "new entitlement does not meet existing usage. Must reduce current usage."
        )

    # Check if the requested subscription is same as the existing one
    if (
        organization.subscription is not None
        and organization.subscription.plan_code == requested_plan.plan_code
        and organization.subscription.seat_count == requested_seat_count
    ):
        logger.warning("the requested subscription is same as the existing one")
        raise RequestedSubscriptionInvalid("the requested subscription is same as the existing one")

    if requested_plan.is_free:
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
            seat_count=requested_seat_count,
        )
    # Existing: paid, Requested: paid (Change from one paid plan to another, or change seat count)
    else:
        result = subscription_service.update_stripe_subscription(
            db_session=context.db_session,
            organization=organization,
            plan=requested_plan,
            seat_count=requested_seat_count,
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
