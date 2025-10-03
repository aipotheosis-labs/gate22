from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from aci.common.db.sql_models_subscription import (
    Organization,
    SubscriptionPlan,
)

"""
CRUD methods for subscription database.
Since there are limited operations for subscription database, we combine all the CRUD methods here
instead of creating a separate file for each model.
"""


def get_active_plan_by_plan_code(
    db_session: Session,
    plan_code: str,
) -> SubscriptionPlan | None:
    statement = select(SubscriptionPlan).where(
        SubscriptionPlan.plan_code == plan_code, SubscriptionPlan.archived_at.is_(None)
    )
    return db_session.execute(statement).scalar_one_or_none()


def get_organization_by_organization_id(
    db_session: Session,
    organization_id: UUID,
) -> Organization | None:
    statement = select(Organization).where(Organization.id == organization_id)
    return db_session.execute(statement).scalar_one_or_none()


def update_organization_stripe_customer_id(
    db_session: Session,
    organization: Organization,
    stripe_customer_id: str,
) -> None:
    organization.stripe_customer_id = stripe_customer_id
    db_session.commit()
