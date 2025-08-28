from uuid import UUID

from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.auth import ActAsInfo
from aci.control_plane.exceptions import NotPermittedError

logger = get_logger(__name__)


def check_permission(
    act_as: ActAsInfo,
    requested_organization_id: UUID | None = None,
    required_role: OrganizationRole = OrganizationRole.MEMBER,
    throw_error_if_not_permitted: bool = True,
) -> bool:
    """
    This function throws an NotPermittedError if the user is not permitted to act as the requested
    organization and role.
    """
    # TODO: Extend this function to check authorization of other entities
    # E.g., MCPServerConfiguration, MCPServerBundle, ConnectedAccount, etc.

    try:
        if requested_organization_id and act_as.organization_id != requested_organization_id:
            raise NotPermittedError(
                message=f"ActAs organization_id {act_as.organization_id} does not match the "
                f"requested organization_id {requested_organization_id}"
            )
        if required_role == OrganizationRole.ADMIN and act_as.role != OrganizationRole.ADMIN:
            raise NotPermittedError(
                message=f"ActAs role {act_as.role} is not permitted to perform this action. "
                f"Required role: {required_role}"
            )
    except NotPermittedError as e:
        logger.error(f"NotPermittedError: {e.message}")
        if throw_error_if_not_permitted:
            raise e
        return False

    return True
