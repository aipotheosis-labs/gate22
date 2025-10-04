from datetime import datetime

from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.logging_setup import get_logger
from aci.common.schemas.subscription import (
    FREE_PLAN_CODE,
    OrganizationSubscriptionUpsert,
    StripeEventData,
)
from aci.control_plane.exceptions import OrganizationNotFound, StripeOperationError

logger = get_logger(__name__)


def handle_customer_subscription_upsert(
    db_session: Session, subscription_data: StripeEventData
) -> None:
    organization = crud.subscriptions.get_organization_by_stripe_customer_id(
        db_session=db_session,
        stripe_customer_id=subscription_data.customer,
    )
    if organization is None:
        logger.error(
            f"Failed to map organization by stripe customer id {subscription_data.customer}"
        )
        raise OrganizationNotFound()

    if len(subscription_data.items.data) != 1:
        logger.error(f"Expected 1 item in subscription, got {len(subscription_data.items.data)}")
        raise StripeOperationError(
            f"Expected 1 item in subscription, got {len(subscription_data.items.data)}"
        )

    subscription_item = subscription_data.items.data[0]

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
            stripe_subscription_id=subscription_data.id,
            stripe_subscription_item_id=subscription_item.id,
            plan_code=plan.plan_code,
            seat_count=subscription_item.quantity,
            status=subscription_data.status,
            current_period_start=datetime.fromtimestamp(subscription_data.current_period_start)
            if subscription_data.current_period_start is not None
            else None,
            current_period_end=datetime.fromtimestamp(subscription_data.current_period_end)
            if subscription_data.current_period_end is not None
            else None,
            cancel_at_period_end=subscription_data.cancel_at_period_end,
            subscription_start_date=datetime.fromtimestamp(subscription_data.start_date)
            if subscription_data.start_date is not None
            else None,
        ),
    )


def handle_customer_subscription_deleted(
    db_session: Session, subscription_data: StripeEventData
) -> None:
    organization = crud.subscriptions.get_organization_by_stripe_customer_id(
        db_session=db_session,
        stripe_customer_id=subscription_data.customer,
    )
    if organization is None:
        logger.error(f"Organization {subscription_data.customer} not found")
        raise OrganizationNotFound()

    free_plan = crud.subscriptions.get_active_plan_by_plan_code(
        db_session=db_session,
        plan_code=FREE_PLAN_CODE,
    )
    if free_plan is None:
        logger.error("Free plan not found")
        raise StripeOperationError("Free plan not found")

    crud.subscriptions.upsert_organization_subscription(
        db_session=db_session,
        organization_id=organization.id,
        upsert_data=OrganizationSubscriptionUpsert(
            stripe_subscription_id=None,
            stripe_subscription_item_id=None,
            plan_code=free_plan.plan_code,
            seat_count=free_plan.max_seats_for_subscription,
            status="active",
            cancel_at_period_end=False,
            current_period_start=None,
            current_period_end=None,
            subscription_start_date=None,
        ),
    )
    logger.info(f"Updated organization subscription for {organization.id} to free plan")
