from datetime import datetime

from sqlalchemy.orm import Session
from stripe import StripeClient, Subscription, SubscriptionItem

from aci.common.db import crud
from aci.common.db.sql_models import Organization
from aci.common.logging_setup import get_logger
from aci.common.schemas.subscription import OrganizationSubscriptionUpsert
from aci.control_plane import config
from aci.control_plane.exceptions import OrganizationNotFound, StripeOperationError

logger = get_logger(__name__)

stripe_client = StripeClient(config.SUBSCRIPTION_STRIPE_SECRET_KEY)


def handle_subscription_event(db_session: Session, subscription_id: str) -> None:
    subscription_data = stripe_client.subscriptions.retrieve(subscription_id)

    logger.info(f"Subscription id: {subscription_data.id}, status: {subscription_data.status}")

    # Get the organization from the customer id
    organization = crud.subscriptions.get_organization_by_stripe_customer_id(
        db_session=db_session,
        stripe_customer_id=subscription_data.customer
        if isinstance(subscription_data.customer, str)
        else subscription_data.customer.id,
    )
    if organization is None:
        logger.error(
            f"Failed to map organization by stripe customer id {subscription_data.customer}"
        )
        raise OrganizationNotFound()

    # Check if the subscription has only one item
    if len(subscription_data.items.data) != 1:
        logger.error(f"Expected 1 item in subscription, got {len(subscription_data.items.data)}")
        raise StripeOperationError(
            f"Expected 1 item in subscription, got {len(subscription_data.items.data)}"
        )

    subscription_item = subscription_data.items.data[0]

    match subscription_data.status:
        # "incomplete": Stripe created the subscription but failed to collect the payment yet.
        # We should not treat it as valid subscription yet.
        case "incomplete":
            pass

        # "active": Stripe successfully collected the payment.
        # "past_due": Stripe has a grace period for the payment.
        # These two are active states. We treat them as valid subscription.
        case "active" | "past_due":
            upsert_customer_subscription(
                db_session=db_session,
                organization=organization,
                subscription=subscription_data,
                subscription_item=subscription_item,
            )

        # "canceled": Stripe canceled the subscription.
        # "incomplete_expired": Stripe failed to collect the payment for a couple times.
        # These two are terminal states. We should remove the subscription from the database if it
        # exists.
        case "canceled" | "incomplete_expired":
            remove_customer_subscription(
                db_session=db_session, organization=organization, subscription=subscription_data
            )

        # "Unpaid": Stripe tries few times and failed to charge the customer. This is unexpected
        # for us since we have automatic_collection enabled.
        # "trialing": Subscription is in the trial period. We don't support trial.
        # "Paused": This state when trial ends without payment method. So this is unexpected for us
        # as we do not support trial.
        case "paused" | "unpaid" | "trialing":
            logger.error(f"Unsupported subscription status {subscription_data.status}")
            raise StripeOperationError(
                f"Unsupported subscription status {subscription_data.status}"
            )


def upsert_customer_subscription(
    db_session: Session,
    organization: Organization,
    subscription: Subscription,
    subscription_item: SubscriptionItem,
) -> None:
    plan = crud.subscriptions.get_plan_by_stripe_price_id(
        db_session=db_session,
        stripe_price_id=subscription_item.price.id,
    )
    if plan is None:
        logger.error(f"Failed to map plan by stripe price id {subscription_item.price.id}")
        raise StripeOperationError(
            f"Failed to map plan by stripe price id {subscription_item.price.id}"
        )

    logger.info(f"Upserting organization subscription for {organization.id}")

    crud.subscriptions.upsert_organization_subscription(
        db_session=db_session,
        organization_id=organization.id,
        upsert_data=OrganizationSubscriptionUpsert(
            stripe_subscription_id=subscription.id,
            stripe_subscription_item_id=subscription_item.id,
            plan_code=plan.plan_code,
            seat_count=subscription_item.quantity if subscription_item.quantity is not None else 0,
            stripe_subscription_status=subscription.status,
            current_period_start=datetime.fromtimestamp(subscription_item.current_period_start)
            if subscription_item.current_period_start is not None
            else None,
            current_period_end=datetime.fromtimestamp(subscription_item.current_period_end)
            if subscription_item.current_period_end is not None
            else None,
            cancel_at_period_end=subscription.cancel_at_period_end,
            subscription_start_date=datetime.fromtimestamp(subscription.start_date)
            if subscription.start_date is not None
            else None,
        ),
    )


def remove_customer_subscription(
    db_session: Session, organization: Organization, subscription: Subscription
) -> None:
    organization_subscription = (
        crud.subscriptions.get_organization_subscription_by_stripe_subscription_id(
            db_session=db_session,
            stripe_subscription_id=subscription.id,
        )
    )
    if organization_subscription is not None:
        crud.subscriptions.delete_organization_subscription(
            db_session=db_session,
            stripe_subscription_id=subscription.id,
        )
    logger.info(f"Deleted organization subscription for organization {organization.id}")
