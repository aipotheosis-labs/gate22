from uuid import UUID, uuid4

from sqlalchemy.orm import Session
from stripe import StripeClient

from aci.common.db import crud
from aci.common.db.sql_models import (
    Organization,
    OrganizationSubscription,
    SubscriptionPlan,
)
from aci.common.logging_setup import get_logger
from aci.common.schemas.subscription import (
    Entitlement,
    SubscriptionCancellation,
    SubscriptionCheckout,
    SubscriptionResult,
)
from aci.control_plane import config
from aci.control_plane.exceptions import (
    OrganizationNotFound,
    StripeOperationError,
)

logger = get_logger(__name__)

stripe_client = StripeClient(config.SUBSCRIPTION_STRIPE_SECRET_KEY)


def is_entitlement_fulfilling_existing_usage(
    db_session: Session, organization_id: UUID, entitlement: Entitlement
) -> bool:
    """
    Check existing usage of the organization.
    This will check
        1. If the entitled seat count >= existing seat in use
        2. If the entitled max custom mcp servers >= existing number of custom mcp servers
    Return True if all conditions are met, False otherwise.
    """
    seat_in_use = crud.organizations.count_organization_members(
        db_session=db_session,
        organization_id=organization_id,
    )
    if entitlement.seat_count is not None and entitlement.seat_count < seat_in_use:
        logger.info(
            f"Entitled seat ({entitlement.seat_count}) less than existing seat in "
            f"use ({seat_in_use})"
        )
        return False

    custom_mcp_servers_in_use = crud.mcp_servers.list_mcp_servers(
        db_session=db_session,
        organization_id=organization_id,
    )
    if entitlement.max_custom_mcp_servers is not None and entitlement.max_custom_mcp_servers < len(
        custom_mcp_servers_in_use
    ):
        logger.info(
            f"Entitled max custom mcp servers ({entitlement.max_custom_mcp_servers}) less "
            f"than existing max custom mcp servers ({len(custom_mcp_servers_in_use)})"
        )
        return False

    return True


def get_organization_entitlement(db_session: Session, organization_id: UUID) -> Entitlement:
    """
    Return the entitlement for the organization.
    """
    organization = crud.organizations.get_organization_by_id(db_session, organization_id)
    if organization is None:
        raise OrganizationNotFound(f"Organization {organization_id} not found")

    # Compute the effective entitlement
    if organization.subscription is None:
        free_plan = crud.subscriptions.get_free_plan(
            db_session=db_session, throw_error_if_not_found=True
        )

        return Entitlement(
            seat_count=free_plan.max_seats_for_subscription,
            max_custom_mcp_servers=free_plan.max_custom_mcp_servers,
            log_retention_days=free_plan.log_retention_days,
        )
    else:
        plan = organization.subscription.subscription_plan
        return Entitlement(
            seat_count=organization.subscription.seat_count,
            max_custom_mcp_servers=plan.max_custom_mcp_servers,
            log_retention_days=plan.log_retention_days,
        )


def create_stripe_subscription(
    db_session: Session,
    organization: Organization,
    plan: SubscriptionPlan,
    seat_count: int,
) -> SubscriptionCheckout:
    """
    Create a stripe subscription. It will create and return a stripe checkout session.
    It will also create a stripe customer id if it is not set.
    Note: This function will NOT update any data in the database. The updated data will be sent
    asynchronously from Stripe webhook and handled by the stripe_event_handler.

    Returns:
        SubscriptionCheckout Object with the stripe checkout session url.
    """

    # Create stripe customer id if it is not set (first time stripe subscription)
    if organization.stripe_customer_id is None:
        stripe_customer = stripe_client.customers.create({"name": organization.name})
        logger.info(f"Stripe customer created: {stripe_customer.id}")
        # TODO: put email / org name as the customer metadata for easier retrieval
        crud.organizations.update_organization_stripe_customer_id(
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

    # Checkout session will created the subscription with `collection_method=automatic_collection`
    # by default.
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
            "subscription_data": {
                "metadata": {
                    "organization_id": str(organization.id),
                    "plan_code": plan.plan_code,
                }
            },
            # Stripe will replace the placeholder {CHECKOUT_SESSION_ID} with the actual session id
            "success_url": f"{config.SUBSCRIPTION_SUCCESS_URL}?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": config.SUBSCRIPTION_CANCEL_URL,
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

    return SubscriptionCheckout(url=stripe_checkout_session.url)


def update_stripe_subscription(
    db_session: Session,
    organization: Organization,
    plan: SubscriptionPlan,
    seat_count: int,
    existing_subscription: OrganizationSubscription,
) -> SubscriptionResult:
    """
    Update the stripe subscription. It will NOT return a stripe checkout session, the update will
    be effective immediately, and stripe will charge / refund the price difference pro-rated
    immediately.

    Note: This function will NOT update any data in the database. The updated data will be sent
    asynchronously from Stripe webhook and handled by the stripe_event_handler.

    Returns:
        SubscriptionResult Object with the stripe subscription id.
    """
    if organization.stripe_customer_id is None:
        logger.error(f"Organization {organization.id} has no stripe customer id")
        raise StripeOperationError(f"Organization {organization.id} has no stripe customer id")

    # Should not happen, we should have checked this in caller
    if plan.stripe_price_id is None:
        logger.error(f"Subscription plan {plan.plan_code} has no stripe price id")
        raise StripeOperationError(f"Subscription plan {plan.plan_code} has no stripe price id")

    # If the price difference is positive, stripe will create a proration and charge the price
    # difference.
    # If the price difference is negative, stripe will issue credit to the customer and the price
    # difference will be deducted from the next period.
    # See https://docs.stripe.com/billing/subscriptions/prorations for details
    subscription = stripe_client.subscriptions.update(
        existing_subscription.stripe_subscription_id,
        {
            "items": [
                {
                    "id": existing_subscription.stripe_subscription_item_id,
                    "price": plan.stripe_price_id,
                    "quantity": seat_count,
                }
            ],
            "proration_behavior": "always_invoice",
        },
    )
    logger.info(f"Stripe subscription updated: {existing_subscription.stripe_subscription_id}")

    return SubscriptionResult(subscription_id=subscription.id)


def cancel_stripe_subscription(
    subscription: OrganizationSubscription,
) -> SubscriptionCancellation:
    """
    Cancel the stripe subscription. It will NOT return a stripe checkout session, the cancellation
    will be effective at the end of the current period.

    Note: This function will NOT update any data in the database. The updated data will be sent
    asynchronously from Stripe webhook and handled by the stripe_event_handler.
    """
    # stripe_client.subscriptions.cancel(subscription.stripe_subscription_id)

    # Set the cancellation at the end of the current period. Stripe will emit an event about
    # cancellation scheduled, and then another cancellation event during the period end.
    stripe_client.subscriptions.update(
        subscription.stripe_subscription_id,
        {
            "cancel_at_period_end": True,
        },
    )

    # Do not update the subscription in the database, it will be updated by the stripe webhook
    return SubscriptionCancellation(subscription_id=subscription.stripe_subscription_id)
