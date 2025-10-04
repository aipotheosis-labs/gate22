from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from aci.common.db.sql_models import (
    Organization,
    OrganizationSubscription,
    OrganizationSubscriptionMetadata,
    SubscriptionPlan,
)
from aci.common.schemas.subscription import (
    OrganizationSubscriptionUpsert,
    SubscriptionPlanCreate,
)

"""
CRUD methods for subscription database.
Since there are limited operations for subscription database, we combine all the CRUD methods here
instead of creating a separate file for each model.
"""


########################################
# Subscription Plan
########################################
def get_active_plan_by_plan_code(
    db_session: Session,
    plan_code: str,
) -> SubscriptionPlan | None:
    statement = select(SubscriptionPlan).where(
        SubscriptionPlan.plan_code == plan_code, SubscriptionPlan.archived_at.is_(None)
    )
    return db_session.execute(statement).scalar_one_or_none()


def get_plan_by_stripe_price_id(
    db_session: Session,
    stripe_price_id: str,
) -> SubscriptionPlan | None:
    statement = select(SubscriptionPlan).where(SubscriptionPlan.stripe_price_id == stripe_price_id)
    return db_session.execute(statement).scalar_one_or_none()


def insert_subscription_plan(
    db_session: Session, plan_data: SubscriptionPlanCreate
) -> SubscriptionPlan:
    plan = SubscriptionPlan(**plan_data.model_dump())
    db_session.add(plan)
    db_session.flush()
    db_session.refresh(plan)
    return plan


########################################
# Organization Billing Metadata
########################################
def get_organization_by_stripe_customer_id(
    db_session: Session,
    stripe_customer_id: str,
) -> Organization | None:
    statement = select(Organization).where(
        Organization.organization_metadata.has(
            OrganizationSubscriptionMetadata.stripe_customer_id == stripe_customer_id
        )
    )
    return db_session.execute(statement).scalar_one_or_none()


def upsert_organization_stripe_customer_id(
    db_session: Session,
    organization: Organization,
    stripe_customer_id: str,
) -> None:
    if organization.organization_metadata is None:
        organization.organization_metadata = OrganizationSubscriptionMetadata(
            stripe_customer_id=stripe_customer_id
        )
        db_session.add(organization.organization_metadata)
    else:
        organization.organization_metadata.stripe_customer_id = stripe_customer_id
    db_session.flush()
    db_session.refresh(organization)


########################################
# Organization Subscription
########################################
def upsert_organization_subscription(
    db_session: Session, organization_id: UUID, upsert_data: OrganizationSubscriptionUpsert
) -> OrganizationSubscription:
    statement = select(OrganizationSubscription).where(
        OrganizationSubscription.organization_id == organization_id
    )
    organization_subscription = db_session.execute(statement).scalar_one_or_none()
    if organization_subscription is None:
        organization_subscription = OrganizationSubscription(
            organization_id=organization_id, **upsert_data.model_dump()
        )
        db_session.add(organization_subscription)
    else:
        for key, value in upsert_data.model_dump(exclude_unset=True).items():
            setattr(organization_subscription, key, value)
    db_session.flush()
    db_session.refresh(organization_subscription)
    return organization_subscription


def get_organization_subscription(
    db_session: Session, organization_id: UUID
) -> OrganizationSubscription | None:
    statement = select(OrganizationSubscription).where(
        OrganizationSubscription.organization_id == organization_id
    )
    return db_session.execute(statement).scalar_one_or_none()


def delete_organization_subscription(db_session: Session, organization_id: UUID) -> None:
    statement = delete(OrganizationSubscription).where(
        OrganizationSubscription.organization_id == organization_id
    )
    db_session.execute(statement)
    db_session.flush()
