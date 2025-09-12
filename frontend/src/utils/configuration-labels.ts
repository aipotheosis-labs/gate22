import { ConnectedAccountOwnership } from "@/features/mcp/types/mcp.types";

/**
 * Utility functions for displaying connected account type labels and information
 */

/**
 * Get display label for ownership type
 */
export const getOwnershipLabel = (
  ownership: ConnectedAccountOwnership | undefined | null,
): string => {
  switch (ownership) {
    case ConnectedAccountOwnership.INDIVIDUAL:
      return "Individual";
    case ConnectedAccountOwnership.SHARED:
      return "Shared";
    default:
      return "Unknown";
  }
};

/**
 * Get detailed information/tooltip content for connected account type
 */
export const getConfigurationTypeDetailedInfo = (
  type: ConnectedAccountOwnership,
): string => {
  switch (type) {
    case ConnectedAccountOwnership.INDIVIDUAL:
      return "Members can create individual connected accounts with their own credentials. Each member manages their own authentication and access.";
    case ConnectedAccountOwnership.SHARED:
      return "Admins can create shared connected accounts that are accessible by team members. The credentials are managed centrally for the entire team.";
    default:
      return "";
  }
};
