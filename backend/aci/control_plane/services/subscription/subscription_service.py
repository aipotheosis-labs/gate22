from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy.orm import Session
from stripe import StripeClient

from aci.common.db import crud
from aci.common.db.sql_models import (
    Organization,
    OrganizationEntitlementOverride,
    OrganizationSubscription,
    SubscriptionPlan,
)
from aci.common.logging_setup import get_logger
from aci.common.schemas.subscription import (
    FREE_PLAN_CODE,
    Entitlement,
    OrganizationSubscriptionUpsert,
    SubscriptionCancelResult,
    SubscriptionCheckout,
    SubscriptionStatus,
)
from aci.control_plane import config
from aci.control_plane.exceptions import (
    RequestedSubscriptionInvalid,
    StripeOperationError,
)

logger = get_logger(__name__)

stripe_client = StripeClient(config.SUBSCRIPTION_STRIPE_SECRET_KEY)


def change_subscription(
    db_session: Session,
    organization: Organization,
    existing_subscription: OrganizationSubscription,
    requested_plan: SubscriptionPlan,
    requested_seat_count: int,
    success_url: str,
    cancel_url: str,
) -> SubscriptionCheckout | SubscriptionCancelResult:
    """
    Routing function for changing the subscription.
    All the change to subscription should go through this function.
    """
    # If the existing subscription seat / plan is same as the requested, nothing to do.
    if (
        existing_subscription.plan_code == requested_plan.plan_code
        and existing_subscription.seat_count == requested_seat_count
    ):
        raise RequestedSubscriptionInvalid("The requested subscription is the same as the existing")

    # Existing: free
    # Requested: paid
    # Upgrade from free plan to paid plan.
    if (
        existing_subscription.plan_code == FREE_PLAN_CODE
        and requested_plan.plan_code != FREE_PLAN_CODE
    ):
        url = _change_stripe_subscription(
            db_session=db_session,
            organization=organization,
            plan=requested_plan,
            seat_count=requested_seat_count,
            success_url=success_url,
            cancel_url=cancel_url,
        )
        return SubscriptionCheckout(url=url)

    # Existing: paid
    # Requested: free
    # Downgrade from paid stripe plan to non-stripe plan.
    elif (
        existing_subscription.plan_code != FREE_PLAN_CODE
        and requested_plan.plan_code == FREE_PLAN_CODE
    ):
        # cancel the stripe subscription
        _cancel_stripe_subscription(existing_subscription)
        return SubscriptionCancelResult()

    # Existing: paid
    # Requested: paid
    # Change from one paid plan to another paid plan, or change seat count
    elif (
        existing_subscription.plan_code != FREE_PLAN_CODE
        and requested_plan.plan_code != FREE_PLAN_CODE
    ):
        # change the stripe subscription
        url = _change_stripe_subscription(
            db_session=db_session,
            organization=organization,
            plan=requested_plan,
            seat_count=requested_seat_count,
            success_url=success_url,
            cancel_url=cancel_url,
        )
        return SubscriptionCheckout(url=url)

    else:
        # Invalid subscription change
        # This should not happen
        logger.error("cannot change from free plan to free plan")
        raise RequestedSubscriptionInvalid("cannot change from free plan to free plan")


def is_new_entitlement_meet_existing_usage(
    db_session: Session, organization_id: UUID, new_entitlement: Entitlement
) -> bool:
    """
    Check existing usage of the organization.
    This will check
        1. If the new seat count >= existing seat in use
        2. If the new max custom mcp servers >= existing number of custom mcp servers
    Return True if all conditions are met, False otherwise.
    """
    seat_in_use = crud.organizations.count_organization_members(
        db_session=db_session,
        organization_id=organization_id,
    )
    if new_entitlement.seat_count < seat_in_use:
        logger.info(
            f"Requested seat ({new_entitlement.seat_count}) less than existing seat in "
            f"use ({seat_in_use})"
        )
        return False

    custom_mcp_servers_in_use = crud.mcp_servers.list_mcp_servers(
        db_session=db_session,
        organization_id=organization_id,
    )
    if new_entitlement.max_custom_mcp_servers < len(custom_mcp_servers_in_use):
        logger.info(
            f"Requested max custom mcp servers ({new_entitlement.max_custom_mcp_servers}) less "
            f"than existing max custom mcp servers ({custom_mcp_servers_in_use})"
        )
        return False

    return True


def compute_effective_entitlement(
    seat_count: int,
    plan: SubscriptionPlan,
    override: OrganizationEntitlementOverride | None,
) -> Entitlement:
    """
    Compute the effective entitlement based on the subscription and the override.
    """
    if override is None or (
        override.expires_at is not None and override.expires_at > datetime.now()
    ):
        return Entitlement(
            seat_count=seat_count,
            max_custom_mcp_servers=plan.config_max_custom_mcp_servers,
            log_retention_days=plan.config_log_retention_days,
        )
    return Entitlement(
        seat_count=(override.seat_count if override.seat_count else seat_count),
        max_custom_mcp_servers=(
            override.max_custom_mcp_servers
            if override.max_custom_mcp_servers
            else plan.config_max_custom_mcp_servers
        ),
        log_retention_days=(
            override.log_retention_days
            if override.log_retention_days
            else plan.config_log_retention_days
        ),
    )


def _set_active_organization_subscription(
    db_session: Session,
    organization: Organization,
    plan: SubscriptionPlan,
    seat_count: int,
) -> None:
    crud.subscriptions.upsert_organization_subscription(
        db_session=db_session,
        organization_id=organization.id,
        upsert_data=OrganizationSubscriptionUpsert(
            plan_code=plan.plan_code,
            seat_count=seat_count,
            status=SubscriptionStatus.ACTIVE,
            cancel_at_period_end=False,
        ),
    )


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
    if (
        organization.organization_metadata is None
        or organization.organization_metadata.stripe_customer_id is None
    ):
        stripe_customer = stripe_client.customers.create()
        # TODO: put email / org name as the customer metadata for easier retrieval
        crud.subscriptions.upsert_organization_stripe_customer_id(
            db_session=db_session,
            organization=organization,
            stripe_customer_id=stripe_customer.id,
        )
        stripe_customer_id = stripe_customer.id
    else:
        stripe_customer_id = organization.organization_metadata.stripe_customer_id

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
