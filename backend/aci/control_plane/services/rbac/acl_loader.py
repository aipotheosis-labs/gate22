from pathlib import Path

import yaml

from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.control_plane.services.rbac.definitions import (
    AllowedResourceCriterion,
    ConnectedAccountAction,
    ControlPlaneActionEnum,
    ControlPlanePermission,
    MCPServerAction,
    MCPServerBundleAction,
    MCPServerConfigurationAction,
    OrganizationAction,
    TeamAction,
)

logger = get_logger(__name__)


def load_acl_role(role: OrganizationRole) -> list[ControlPlanePermission]:
    role_permissions: list[ControlPlanePermission] = []
    with open(Path(__file__).parent / "acl" / f"{role.value}.yml") as f:
        acl_yaml = yaml.safe_load(f)
        permissions_yaml = acl_yaml["roles"][role.value]["permissions"]

        for permission_yaml in permissions_yaml:
            role_permissions.append(
                ControlPlanePermission(
                    action=_parse_action(permission_yaml["action"]),
                    resource_type=permission_yaml["resource_type"]
                    if "resource_type" in permission_yaml
                    else None,
                    allowed_resource_criteria=[
                        AllowedResourceCriterion.model_validate(allowed_yaml)
                        for allowed_yaml in permission_yaml["allowed"]
                    ]
                    if "allowed" in permission_yaml
                    else None,
                )
            )

    # Check for duplicate actions
    actions_seen = set()
    for permission in role_permissions:
        if permission.action in actions_seen:
            raise ValueError(f"Duplicate action {permission.action} found for role {role.value}")
        actions_seen.add(permission.action)

    return role_permissions


def load_acl() -> dict[OrganizationRole, list[ControlPlanePermission]]:
    acl: dict[OrganizationRole, list[ControlPlanePermission]] = {}
    for role in OrganizationRole:
        acl[role] = load_acl_role(role)
        logger.info(f"Loaded RBAC ACL for {role}")

    return acl


def _parse_action(action_str: str) -> ControlPlaneActionEnum:
    for enum_cls in (
        MCPServerAction,
        MCPServerConfigurationAction,
        MCPServerBundleAction,
        ConnectedAccountAction,
        TeamAction,
        OrganizationAction,
    ):
        try:
            action_enum = enum_cls(action_str)
            return action_enum
        except ValueError:
            continue
    raise ValueError(f"Invalid action: {action_str}")


ACL: dict[OrganizationRole, list[ControlPlanePermission]] = load_acl()
