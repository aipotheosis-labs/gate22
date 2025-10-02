from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from stripe import StripeClient

from aci.common.logging_setup import get_logger
from aci.subscription import config
from aci.subscription import dependencies as deps
from aci.subscription.db import crud
from aci.subscription.db.sql_models import (
    Organization,
    OrganizationEntitlementOverride,
    OrganizationSubscription,
    SubscriptionPlan,
)
from aci.subscription.exceptions import (
    OrganizationNotFound,
    OrganizationSubscriptionNotFound,
    RequestedSubscriptionInvalid,
    RequestedSubscriptionNotAvailable,
    StripeOperationError,
)
from aci.subscription.schemas.organization_subscription import (
    FREE_PLAN_CODE,
    Entitlement,
    SubscriptionCancelResult,
    SubscriptionCheckout,
    SubscriptionPublic,
    SubscriptionRequest,
    SubscriptionStatusPublic,
)

logger = get_logger(__name__)
router = APIRouter()

stripe_client = StripeClient(config.STRIPE_SECRET_KEY)


@router.get(
    "{organization_id}/subscription-status",
    response_model=SubscriptionStatusPublic,
    status_code=status.HTTP_200_OK,
)
async def get_organization_entitlement(
    db_session: Annotated[Session, Depends(deps.yield_db_session)], organization_id: UUID
) -> SubscriptionStatusPublic:
    organization = crud.get_organization_by_organization_id(
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
    effective_entitlement = _compute_effective_entitlement(
        subscription=organization.subscription,
        override=organization.entitlement_overrides,
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
    "{organization_id}/change-subscription",
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
    organization = crud.get_organization_by_organization_id(
        db_session=db_session,
        organization_id=organization_id,
    )

    if organization is None:
        logger.error(f"Organization {organization_id} not found")
        raise OrganizationNotFound()

    if input.plan_code == FREE_PLAN_CODE:
        subscription = organization.subscription
        if subscription is None:
            logger.error(f"Organization {organization_id} has no subscription")
            raise OrganizationSubscriptionNotFound()
        if subscription.plan.plan_code == FREE_PLAN_CODE:
            logger.error(f"Organization {organization_id} is already on the free plan")
            raise RequestedSubscriptionInvalid("Organization is already on the free plan")

        _cancel_stripe_subscription(subscription)

        return SubscriptionCancelResult()
    else:
        # Check if the plan is active
        plan = crud.get_active_plan_by_plan_code(
            db_session=db_session,
            plan_code=input.plan_code,
        )
        if plan is None or not plan.is_public or plan.stripe_price_id is None:
            logger.error(f"Subscription plan {input.plan_code} not available for subscription")
            raise RequestedSubscriptionNotAvailable()

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

        url = _change_stripe_subscription(
            db_session=db_session,
            organization=organization,
            plan=plan,
            seat_count=input.seat_count,
            success_url=str(input.success_url),
            cancel_url=str(input.cancel_url),
        )
    return SubscriptionCheckout(url=url)


def _cancel_stripe_subscription(
    subscription: OrganizationSubscription,
) -> None:
    if subscription.stripe_subscription_id is None:
        logger.error(f"Subscription {subscription.id} has no stripe subscription id")
        raise StripeOperationError(f"Subscription {subscription.id} has no stripe subscription id")
    stripe_client.subscriptions.cancel(subscription.stripe_subscription_id)

    # Do not update the subscription in the database, it will be updated by the stripe webhook


def _change_stripe_subscription(
    db_session: Session,
    organization: Organization,
    plan: SubscriptionPlan,
    seat_count: int,
    success_url: str,
    cancel_url: str,
) -> str:
    # Create stripe customer id if it is not set (first time stripe subscription)
    if organization.stripe_customer_id is None:
        stripe_customer = stripe_client.customers.create()
        # TODO: put email / org name as the customer metadata for easier retrieval
        crud.update_organization_stripe_customer_id(
            db_session=db_session,
            organization=organization,
            stripe_customer_id=stripe_customer.id,
        )
        stripe_customer_id = stripe_customer.id
    else:
        stripe_customer_id = organization.stripe_customer_id

    # Should not happen, we should have checked this in caller
    if plan.stripe_price_id is None:
        logger.error(f"Subscription plan {plan.plan_code} has no stripe price id")
        raise StripeOperationError(f"Subscription plan {plan.plan_code} has no stripe price id")

    # Checkout the subscription
    idempotency_key = f"{organization.id}-{plan.plan_code}-{uuid4()!s}"
    stripe_checkout_session = stripe_client.checkout.sessions.create(
        {
            "customer": stripe_customer_id,
            "mode": "subscription",
            "ui_mode": "hosted",
            "line_items": [
                {
                    "price": plan.stripe_price_id,
                    "quantity": seat_count,
                }
            ],
            "success_url": success_url,
            "cancel_url": cancel_url,
        },
        {
            "idempotency_key": idempotency_key,
        },
    )

    logger.info(f"Stripe checkout session created: {stripe_checkout_session.id}")

    if stripe_checkout_session.url is None:
        logger.error(f"Stripe checkout session has no url: {stripe_checkout_session.id}")
        raise StripeOperationError(
            f"Stripe checkout session has no url: {stripe_checkout_session.id}"
        )

    return stripe_checkout_session.url


def _compute_effective_entitlement(
    subscription: OrganizationSubscription,
    override: OrganizationEntitlementOverride | None,
) -> Entitlement:
    """
    Compute the effective entitlement based on the subscription and the override.
    """
    return Entitlement(
        seat_count=(
            override.seat_count if override and override.seat_count else subscription.seat_count
        ),
        max_custom_mcp_servers=(
            override.max_custom_mcp_servers
            if override and override.max_custom_mcp_servers
            else subscription.plan.config_max_custom_mcp_servers
        ),
        log_retention_days=(
            override.log_retention_days
            if override and override.log_retention_days
            else subscription.plan.config_log_retention_days
        ),
    )
