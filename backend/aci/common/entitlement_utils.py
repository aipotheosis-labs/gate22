from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import OrganizationEntitlementOverride, SubscriptionPlan
from aci.common.exceptions import OrganizationNotFoundError
from aci.common.logging_setup import get_logger
from aci.common.schemas.subscription import Entitlement, OrganizationUsage

logger = get_logger(__name__)


def get_organization_usage(db_session: Session, organization_id: UUID) -> OrganizationUsage:
    seat_in_use = crud.organizations.count_organization_members(
        db_session=db_session,
        organization_id=organization_id,
    )
    custom_mcp_servers_in_use = crud.mcp_servers.list_mcp_servers(
        db_session=db_session,
        organization_id=organization_id,
    )
    return OrganizationUsage(
        seat_count=seat_in_use,
        custom_mcp_servers_count=len(custom_mcp_servers_in_use),
    )


def is_entitlement_fulfilling_usage(entitlement: Entitlement, usage: OrganizationUsage) -> bool:
    """
    Check existing usage of the organization.
    This will check
        1. If the entitled seat count >= existing seat in use
        2. If the entitled max custom mcp servers >= existing number of custom mcp servers
    Return True if all conditions are met, False otherwise.
    """

    if entitlement.seat_count is not None and entitlement.seat_count < usage.seat_count:
        logger.info(
            f"Entitled seat ({entitlement.seat_count}) less than existing seat in "
            f"use ({usage.seat_count})"
        )
        return False

    if (
        entitlement.max_custom_mcp_servers is not None
        and entitlement.max_custom_mcp_servers < usage.custom_mcp_servers_count
    ):
        logger.info(
            f"Entitled max custom mcp servers ({entitlement.max_custom_mcp_servers}) less "
            f"than existing max custom mcp servers ({usage.custom_mcp_servers_count})"
        )
        return False

    return True


def compute_effective_entitlement(
    plan: SubscriptionPlan,
    seat_count: int | None,
    override: OrganizationEntitlementOverride | None,
) -> Entitlement:
    """
    Compute the effective entitlement based on the subscription and the override.
    """
    if seat_count is None:
        if plan.is_free:
            seat_count = plan.max_seats_for_subscription
        else:
            logger.error("seat count must be provided for paid plan")
            raise ValueError("seat count must be provided for paid plan")

    if override is None or (
        override.expires_at is not None and datetime.now(UTC) > override.expires_at
    ):
        return Entitlement(
            seat_count=seat_count,
            max_custom_mcp_servers=plan.max_custom_mcp_servers,
            log_retention_days=plan.log_retention_days,
        )
    return Entitlement(
        seat_count=(override.seat_count if override.seat_count is not None else seat_count),
        max_custom_mcp_servers=(
            override.max_custom_mcp_servers
            if override.max_custom_mcp_servers is not None
            else plan.max_custom_mcp_servers
        ),
        log_retention_days=(
            override.log_retention_days
            if override.log_retention_days is not None
            else plan.log_retention_days
        ),
    )


def get_organization_entitlement(db_session: Session, organization_id: UUID) -> Entitlement:
    organization = crud.organizations.get_organization_by_id(db_session, organization_id)
    if organization is None:
        raise OrganizationNotFoundError(f"Organization {organization_id} not found")

    # Compute the effective entitlement
    if organization.subscription is None:
        plan = crud.subscriptions.get_free_plan(
            db_session=db_session, throw_error_if_not_found=True
        )
    else:
        plan = organization.subscription.plan

    effective_entitlement = compute_effective_entitlement(
        plan=plan,
        seat_count=organization.subscription.seat_count
        if organization.subscription is not None
        else None,
        override=organization.entitlement_override,
    )

    return effective_entitlement
