from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.logging_setup import get_logger
from aci.common.schemas.subscription import (
    FREE_PLAN_CODE,
    StripeWebhookEvent,
    SubscriptionCancelResult,
    SubscriptionCheckout,
    SubscriptionPublic,
    SubscriptionRequest,
    SubscriptionStatusPublic,
)
from aci.control_plane import dependencies as deps
from aci.control_plane.exceptions import (
    OrganizationNotFound,
    OrganizationSubscriptionNotFound,
    RequestedSubscriptionInvalid,
    RequestedSubscriptionNotAvailable,
)
from aci.control_plane.services.subscription import subscription_service

logger = get_logger(__name__)
router = APIRouter()


@router.get(
    "/organizations/{organization_id}/subscription-status",
    response_model=SubscriptionStatusPublic,
    status_code=status.HTTP_200_OK,
)
async def get_organization_entitlement(
    db_session: Annotated[Session, Depends(deps.yield_db_session)], organization_id: UUID
) -> SubscriptionStatusPublic:
    organization = crud.organizations.get_organization_by_id(
        db_session=db_session,
        organization_id=organization_id,
    )
    if organization is None:
        logger.error(f"Organization {organization_id} not found")
        raise OrganizationNotFound()
    if organization.subscription is None:
        logger.error(f"Organization {organization_id} has no subscription")
        raise OrganizationSubscriptionNotFound()

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
    response_model=SubscriptionCheckout | SubscriptionCancelResult,
    status_code=status.HTTP_200_OK,
)
async def change_organization_subscription(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    organization_id: UUID,
    input: SubscriptionRequest,
) -> SubscriptionCheckout | SubscriptionCancelResult:
    """
    Change the stripe subscription for the organization.
    Use this to change seat count or change plan.
    If the organization does not have a stripe customer id, it will be created.
    Returns the checkout url.
    """
    organization = crud.organizations.get_organization_by_id(
        db_session=db_session,
        organization_id=organization_id,
    )

    if organization is None:
        logger.error(f"Organization {organization_id} not found")
        raise OrganizationNotFound()

    # Check if the plan is active
    plan = crud.subscriptions.get_active_plan_by_plan_code(
        db_session=db_session,
        plan_code=input.plan_code,
    )
    if plan is None or not plan.is_public or plan.stripe_price_id is None:
        logger.error(f"Subscription plan {input.plan_code} not available for subscription")
        raise RequestedSubscriptionNotAvailable()

    # This is a special case for the free plan, where we auto set the seat count to max available
    # seats for Free Plan.
    if input.plan_code == FREE_PLAN_CODE:
        input.seat_count = plan.max_seats_for_subscription
    else:
        if input.seat_count is None:
            raise RequestedSubscriptionInvalid("Seat count must be provided")

    # Check if the seat_requested matches the plan
    # plan.min_seat_for_subscription < requested_seat < plan.max_seat_for_subscription
    if (
        input.seat_count < plan.min_seats_for_subscription
        or input.seat_count > plan.max_seats_for_subscription
    ):
        logger.info(
            f"Requested seat count {input.seat_count} is invalid for plan {input.plan_code}"
        )
        raise RequestedSubscriptionInvalid("Requested seat count is invalid for plan")

    # calculate effective entitlement after the change
    effective_entitlement_after_change = subscription_service.compute_effective_entitlement(
        seat_count=input.seat_count,
        plan=plan,
        override=organization.entitlement_override,
    )
    if not subscription_service.is_new_entitlement_meet_existing_usage(
        db_session=db_session,
        organization_id=organization_id,
        new_entitlement=effective_entitlement_after_change,
    ):
        raise RequestedSubscriptionInvalid(
            "New entitlement does not meet existing usage. Must reduce current usage."
        )

    if input.plan_code == FREE_PLAN_CODE:
        if organization.subscription is None:
            logger.error(f"Organization {organization_id} has no subscription")
            raise OrganizationSubscriptionNotFound()
        if organization.subscription.plan_code == FREE_PLAN_CODE:
            logger.error(f"Organization {organization_id} is already on the free plan")
            raise RequestedSubscriptionInvalid("Organization is already on the free plan")

        subscription_service.cancel_stripe_subscription(organization.subscription)

        return SubscriptionCancelResult()
    else:
        url = subscription_service.change_stripe_subscription(
            db_session=db_session,
            organization=organization,
            plan=plan,
            seat_count=input.seat_count,
            success_url=str(input.success_url),
            cancel_url=str(input.cancel_url),
        )
    return SubscriptionCheckout(url=url)


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
        case "customer.subscription.created":
            # subscription = body.data.object
            pass
        case "customer.subscription.updated":
            pass
        case "customer.subscription.deleted":
            pass

    return None
