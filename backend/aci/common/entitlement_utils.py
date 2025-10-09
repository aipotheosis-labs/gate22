from uuid import UUID

from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.exceptions import OrganizationNotFoundError
from aci.common.logging_setup import get_logger
from aci.common.schemas.subscription import Entitlement

logger = get_logger(__name__)


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
        raise OrganizationNotFoundError(f"Organization {organization_id} not found")

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
