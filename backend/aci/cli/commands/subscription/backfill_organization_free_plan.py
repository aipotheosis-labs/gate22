import click
from rich.console import Console
from sqlalchemy.orm import Session

from aci.cli import config
from aci.common import utils
from aci.common.db import crud
from aci.common.db.sql_models import Organization
from aci.common.schemas.subscription import (
    FREE_PLAN_CODE,
    OrganizationSubscriptionUpsert,
    SubscriptionStatus,
)

console = Console()


@click.command()
def backfill_organization_free_plan() -> None:
    console.print("Inserting plan")
    with utils.create_db_session(config.DB_FULL_URL) as db_session:
        backfill_organization_free_plan_impl(db_session)


def backfill_organization_free_plan_impl(db_session: Session) -> None:
    organizations = db_session.query(Organization).all()
    free_plan = crud.subscriptions.get_active_plan_by_plan_code(db_session, FREE_PLAN_CODE)
    if free_plan is None:
        raise Exception("Free plan not found")

    count = 0
    for organization in organizations:
        if organization.subscription is not None:
            console.print(
                f"[yellow]Organization {organization.id} already has a subscription. Skip.[/yellow]"
            )
            continue

        crud.subscriptions.upsert_organization_subscription(
            db_session,
            organization.id,
            OrganizationSubscriptionUpsert(
                plan_code=free_plan.plan_code,
                seat_count=free_plan.max_seats_for_subscription,
                status=SubscriptionStatus.ACTIVE,
                cancel_at_period_end=False,
            ),
        )
        count += 1
        console.print(f"[yellow]Backfilled Free Plan for organization: {organization.id}[/yellow]")

    db_session.commit()
    console.print(f"[green]Done backfilling {count} organizations[/green]")
