"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  MCPServerConfigurationPublicBasic,
  ConnectedAccountOwnership,
} from "@/features/mcp/types/mcp.types";
import { ConnectedAccount } from "@/features/connected-accounts/types/connectedaccount.types";

interface ManageMCPConfigurationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availableConfigurations: MCPServerConfigurationPublicBasic[];
  connectedAccounts?: ConnectedAccount[];
  alreadySelectedIds: string[];
  onConfirm: (additions: string[], removals: string[]) => void;
  hasValidSharedAccount?: (configId: string) => boolean;
}

export function ManageMCPConfigurationDialog({
  isOpen,
  onClose,
  availableConfigurations,
  connectedAccounts = [],
  alreadySelectedIds,
  onConfirm,
  hasValidSharedAccount,
}: ManageMCPConfigurationDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConfigIds, setSelectedConfigIds] = useState<Set<string>>(
    new Set(),
  );

  // Sync selected configs with alreadySelectedIds when dialog opens or data changes
  useEffect(() => {
    if (isOpen) {
      setSelectedConfigIds(new Set(alreadySelectedIds));
    }
  }, [isOpen, alreadySelectedIds]);

  // Filter all configurations by search (show both selected and unselected)
  const availableToSelect = useMemo(() => {
    return availableConfigurations.filter((config) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        config.name.toLowerCase().includes(query) ||
        config.description?.toLowerCase().includes(query) ||
        config.mcp_server?.name.toLowerCase().includes(query) ||
        config.mcp_server?.description?.toLowerCase().includes(query)
      );
    });
  }, [availableConfigurations, searchQuery]);

  // Check if configuration has available accounts (for individual use)
  const hasAvailableAccounts = (config: MCPServerConfigurationPublicBasic) => {
    const isSharedAccount =
      config.connected_account_ownership === ConnectedAccountOwnership.SHARED;
    const configAccounts = connectedAccounts.filter(
      (account) => account.mcp_server_configuration_id === config.id,
    );

    if (isSharedAccount) {
      return hasValidSharedAccount ? hasValidSharedAccount(config.id) : false;
    }
    return configAccounts.length > 0;
  };

  const handleConfigToggle = (configId: string) => {
    setSelectedConfigIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(configId)) {
        newSet.delete(configId);
      } else {
        newSet.add(configId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    // Calculate additions and removals
    const additions = Array.from(selectedConfigIds).filter(
      (id) => !alreadySelectedIds.includes(id),
    );
    const removals = alreadySelectedIds.filter(
      (id) => !selectedConfigIds.has(id),
    );
    onConfirm(additions, removals);
    handleClose();
  };

  const handleClose = () => {
    // Reset to original state when closing without confirming
    setSelectedConfigIds(new Set(alreadySelectedIds));
    setSearchQuery("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl h-[600px] flex flex-col">
        <DialogHeader className="flex-shrink-0 px-3 pt-4">
          <DialogTitle>Manage MCP Configuration</DialogTitle>
          <DialogDescription>
            Select configurations to add to your bundle. Uncheck existing ones
            to remove them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col space-y-3 px-3 py-2 flex-1 min-h-0">
          {/* Search */}
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search configurations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Configuration List */}
          <div className="flex-1 min-h-0">
            {availableToSelect.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? "No configurations match your search"
                  : "No configurations available"}
              </div>
            ) : (
              <div className="h-full overflow-y-auto border rounded-md">
                <div className="space-y-1 p-1">
                  {availableToSelect.map((config) => {
                    const hasAccounts = hasAvailableAccounts(config);
                    const isSelected = selectedConfigIds.has(config.id);

                    return (
                      <div
                        key={config.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-md transition-colors",
                          hasAccounts
                            ? "cursor-pointer hover:bg-muted/50"
                            : "cursor-default opacity-50",
                          isSelected && "bg-muted/50",
                        )}
                        onClick={() =>
                          hasAccounts && handleConfigToggle(config.id)
                        }
                      >
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          disabled={!hasAccounts}
                          onCheckedChange={() =>
                            hasAccounts && handleConfigToggle(config.id)
                          }
                          onClick={(event) => event.stopPropagation()}
                        />

                        {/* Logo */}
                        {config.mcp_server?.logo && (
                          <div className="relative h-5 w-5 shrink-0">
                            <Image
                              src={config.mcp_server.logo}
                              alt=""
                              fill
                              className="object-contain rounded-sm"
                              unoptimized
                            />
                          </div>
                        )}

                        {/* Configuration Name */}
                        <div className="flex-1 min-w-0">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              !hasAccounts && "text-muted-foreground",
                            )}
                          >
                            {config.name}
                          </span>
                          {!hasAccounts ? (
                            <span className="text-xs text-destructive ml-2">
                              (No connected accounts)
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground ml-2">
                              {(() => {
                                const isSharedAccount =
                                  config.connected_account_ownership ===
                                  ConnectedAccountOwnership.SHARED;
                                if (isSharedAccount) {
                                  return "(Shared Account)";
                                } else {
                                  const configAccounts =
                                    connectedAccounts.filter(
                                      (account) =>
                                        account.mcp_server_configuration_id ===
                                        config.id,
                                    );
                                  if (configAccounts.length === 1) {
                                    const account = configAccounts[0];
                                    const accountName =
                                      account.user?.email ||
                                      account.user?.name ||
                                      "Connected Account";
                                    return `(${accountName})`;
                                  } else if (configAccounts.length > 1) {
                                    const accountNames = configAccounts
                                      .map(
                                        (acc) =>
                                          acc.user?.email ||
                                          acc.user?.name ||
                                          "Account",
                                      )
                                      .slice(0, 2); // Show first 2 accounts
                                    const remaining = configAccounts.length - 2;
                                    return remaining > 0
                                      ? `(${accountNames.join(", ")} +${remaining} more)`
                                      : `(${accountNames.join(", ")})`;
                                  }
                                  return "(Individual Account)";
                                }
                              })()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-3 pb-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              Array.from(selectedConfigIds).filter(
                (id) => !alreadySelectedIds.includes(id),
              ).length === 0 &&
              alreadySelectedIds.every((id) => selectedConfigIds.has(id))
            }
          >
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
