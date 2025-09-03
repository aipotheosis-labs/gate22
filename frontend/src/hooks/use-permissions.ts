import { useMemo } from "react";
import { useMetaInfo } from "@/components/context/metainfo";
import {
  checkPermission,
  checkMultiplePermissions,
  getPermissionsForRole,
} from "@/lib/rbac/rbac-service";
import { Permission } from "@/lib/rbac/permissions";
import { OrganizationRole } from "@/features/settings/types/organization.types";

/**
 * Hook to check if current user has a specific permission
 */
export function usePermission(permission: Permission): boolean {
  const { activeOrg, isActingAsRole } = useMetaInfo();

  return useMemo(() => {
    if (!activeOrg) return false;

    // Use member role if admin is acting as member
    const roleToCheck =
      isActingAsRole && activeOrg.userRole === OrganizationRole.Admin
        ? OrganizationRole.Member
        : activeOrg.userRole;

    return checkPermission(roleToCheck.toLowerCase(), permission);
  }, [activeOrg, isActingAsRole, permission]);
}

/**
 * Hook to check if current user has multiple permissions
 */
export function usePermissions(
  permissions: Permission[],
  mode: "all" | "any" = "all",
): boolean {
  const { activeOrg, isActingAsRole } = useMetaInfo();

  return useMemo(() => {
    if (!activeOrg) return false;

    // Use member role if admin is acting as member
    const roleToCheck =
      isActingAsRole && activeOrg.userRole === OrganizationRole.Admin
        ? OrganizationRole.Member
        : activeOrg.userRole;

    return checkMultiplePermissions(
      roleToCheck.toLowerCase(),
      permissions,
      mode,
    );
  }, [activeOrg, isActingAsRole, permissions, mode]);
}

/**
 * Hook to get current user's role information
 */
export function useRole(): {
  role: string;
  activeRole: string;
  isAdmin: boolean;
  isMember: boolean;
  isActingAsMember: boolean;
} {
  const { activeOrg, isActingAsRole } = useMetaInfo();

  return useMemo(() => {
    const userRole = activeOrg?.userRole || "";
    const activeRole =
      isActingAsRole && userRole === OrganizationRole.Admin
        ? OrganizationRole.Member.toLowerCase()
        : userRole.toLowerCase();

    return {
      role: userRole.toLowerCase(),
      activeRole,
      isAdmin: userRole === OrganizationRole.Admin,
      isMember: userRole === OrganizationRole.Member,
      isActingAsMember: userRole === OrganizationRole.Admin && isActingAsRole,
    };
  }, [activeOrg, isActingAsRole]);
}

/**
 * Hook to get all permissions for the current user
 */
export function useUserPermissions(): readonly Permission[] {
  const { activeOrg, isActingAsRole } = useMetaInfo();

  return useMemo(() => {
    if (!activeOrg) return [];

    // Use member role if admin is acting as member
    const roleToCheck =
      isActingAsRole && activeOrg.userRole === OrganizationRole.Admin
        ? OrganizationRole.Member
        : activeOrg.userRole;

    return getPermissionsForRole(roleToCheck.toLowerCase());
  }, [activeOrg, isActingAsRole]);
}

/**
 * Hook to check if user can perform an action on a resource
 * Considers ownership for resource-specific actions
 */
export function useCanPerformAction(
  action: Permission,
  resourceOwnerId?: string,
): boolean {
  const { activeOrg, isActingAsRole, user } = useMetaInfo();

  return useMemo(() => {
    if (!activeOrg || !user) return false;

    // Use member role if admin is acting as member
    const roleToCheck =
      isActingAsRole && activeOrg.userRole === OrganizationRole.Admin
        ? OrganizationRole.Member
        : activeOrg.userRole;

    // Check base permission first
    const hasPermission = checkPermission(roleToCheck.toLowerCase(), action);

    // For ownership-based permissions, check if user owns the resource
    // This is a simplified check - you may want to expand this based on your needs
    if (hasPermission && resourceOwnerId) {
      // If action requires ownership (e.g., delete_own), verify ownership
      if (action.includes("_own")) {
        return resourceOwnerId === user.userId;
      }
    }

    return hasPermission;
  }, [activeOrg, isActingAsRole, user, action, resourceOwnerId]);
}
