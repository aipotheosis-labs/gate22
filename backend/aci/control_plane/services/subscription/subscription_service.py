from uuid import uuid4

from sqlalchemy.orm import Session
from stripe import StripeClient

from aci.common.db import crud
from aci.common.db.sql_models_subscription import (
    Organization,
    OrganizationEntitlementOverride,
    OrganizationSubscription,
    SubscriptionPlan,
)
from aci.common.logging_setup import get_logger
from aci.common.schemas.subscription import Entitlement
from aci.control_plane import config
from aci.control_plane.exceptions import StripeOperationError

logger = get_logger(__name__)

stripe_client = StripeClient(config.SUBSCRIPTION_STRIPE_SECRET_KEY)


def cancel_stripe_subscription(
    subscription: OrganizationSubscription,
) -> None:
    if subscription.stripe_subscription_id is None:
        logger.error(f"Subscription {subscription.id} has no stripe subscription id")
        raise StripeOperationError(f"Subscription {subscription.id} has no stripe subscription id")
    stripe_client.subscriptions.cancel(subscription.stripe_subscription_id)

    # Do not update the subscription in the database, it will be updated by the stripe webhook


def change_stripe_subscription(
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
        crud.subscriptions.update_organization_stripe_customer_id(
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


def compute_effective_entitlement(
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
