from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.subscription import (
    FREE_PLAN_CODE,
    StripeWebhookEvent,
    SubscriptionCancellation,
    SubscriptionCheckout,
    SubscriptionPublic,
    SubscriptionRequest,
    SubscriptionResult,
    SubscriptionStatusPublic,
)
from aci.control_plane import access_control
from aci.control_plane import dependencies as deps
from aci.control_plane.exceptions import (
    OrganizationNotFound,
    RequestedSubscriptionInvalid,
    RequestedSubscriptionNotAvailable,
)
from aci.control_plane.services.subscription import stripe_event_handler, subscription_service

logger = get_logger(__name__)
router = APIRouter()


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
    effective_entitlement = subscription_service.compute_effective_entitlement(
        seat_count=organization.subscription.seat_count,
        plan=organization.subscription.plan,
        override=organization.entitlement_override,
    )

    subscription_public = SubscriptionPublic.model_validate(
        organization.subscription, from_attributes=True
    )

    subscription_status_public = SubscriptionStatusPublic(
        subscription=subscription_public,
        entitlement=effective_entitlement,
    )

    return subscription_status_public


@router.post(
    "/organizations/{organization_id}/change-subscription",
    response_model=SubscriptionCheckout | SubscriptionCancellation | SubscriptionResult,
    status_code=status.HTTP_200_OK,
)
async def change_organization_subscription(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    organization_id: UUID,
    input: SubscriptionRequest,
) -> SubscriptionCheckout | SubscriptionCancellation | SubscriptionResult:
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

    # Check if the plan is active
    plan = crud.subscriptions.get_active_plan_by_plan_code(
        db_session=context.db_session,
        plan_code=input.plan_code,
    )
    if plan is None or not plan.is_public:
        logger.error(f"Subscription plan {input.plan_code} not available for subscription")
        raise RequestedSubscriptionNotAvailable()

    # This is a special case for the free plan, where we auto set the seat count to max available
    # seats for Free Plan.
    if input.plan_code == FREE_PLAN_CODE:
        input.seat_count = plan.max_seats_for_subscription
    else:
        if input.seat_count is None:
            raise RequestedSubscriptionInvalid("Seat count must be provided")
        if input.success_url is None or input.cancel_url is None:
            raise RequestedSubscriptionInvalid("success_url and cancel_url must be provided")
        if plan.stripe_price_id is None:
            raise RequestedSubscriptionInvalid(
                "Subscription plan not available for self-served subscription"
            )

    # Check if the seat_requested matches the plan
    # plan.min_seat_for_subscription < requested_seat < plan.max_seat_for_subscription
    if (
        input.seat_count < plan.min_seats_for_subscription
        or input.seat_count > plan.max_seats_for_subscription
    ):
        logger.info(f"Requested seat count {input.seat_count} invalid for plan {input.plan_code}")
        raise RequestedSubscriptionInvalid("requested seat count is invalid for plan")

    # calculate effective entitlement after the change
    effective_entitlement_after_change = subscription_service.compute_effective_entitlement(
        seat_count=input.seat_count,
        plan=plan,
        override=organization.entitlement_override,
    )
    if not subscription_service.is_new_entitlement_meet_existing_usage(
        db_session=context.db_session,
        organization_id=organization_id,
        new_entitlement=effective_entitlement_after_change,
    ):
        raise RequestedSubscriptionInvalid(
            "new entitlement does not meet existing usage. Must reduce current usage."
        )

    result = subscription_service.change_subscription(
        db_session=context.db_session,
        organization=organization,
        existing_subscription=organization.subscription,
        requested_plan=plan,
        requested_seat_count=input.seat_count,
        success_url=str(input.success_url),
        cancel_url=str(input.cancel_url),
    )

    context.db_session.commit()
    return result


EVENT_TYPES = [
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
]


@router.post(
    "/stripe/webhook",
    response_model=None,
    status_code=status.HTTP_200_OK,
)
async def stripe_webhook(
    db_session: Annotated[Session, Depends(deps.yield_db_session)], body: StripeWebhookEvent
) -> None:
    match body.type:
        case "customer.subscription.created" | "customer.subscription.updated":
            stripe_event_handler.handle_customer_subscription_upsert(
                db_session=db_session,
                subscription_data=body.data.object,
            )
        case "customer.subscription.deleted":
            stripe_event_handler.handle_customer_subscription_deleted(
                db_session=db_session,
                subscription_data=body.data.object,
            )

    db_session.commit()
    return None
