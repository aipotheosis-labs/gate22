"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { MCPServerConfigurationPublicBasic, ConnectedAccountOwnership } from "@/features/mcp/types/mcp.types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface ConfigurationSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availableConfigurations: MCPServerConfigurationPublicBasic[];
  connectedAccounts?: any[];
  alreadySelectedIds: string[];
  onConfirm: (configurationId: string) => void;
}

export function ConfigurationSelectionDialog({
  isOpen,
  onClose,
  availableConfigurations,
  connectedAccounts = [],
  alreadySelectedIds,
  onConfirm,
}: ConfigurationSelectionDialogProps) {
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [open, setOpen] = useState(false);

  // Filter out already selected configurations
  const availableToSelect = availableConfigurations.filter(
    (config) => !alreadySelectedIds.includes(config.id)
  );

  // Check if selected configuration has available accounts (for individual type)
  const selectedConfig = availableConfigurations.find(c => c.id === selectedConfigId);
  const isSharedAccount = selectedConfig?.connected_account_ownership === ConnectedAccountOwnership.SHARED;
  const configAccounts = selectedConfigId ? connectedAccounts.filter(
    account => account.mcp_server_configuration_id === selectedConfigId
  ) : [];
  const hasAvailableAccounts = isSharedAccount || configAccounts.length > 0;
  const canAddConfiguration = selectedConfigId && hasAvailableAccounts;


  const handleConfirm = () => {
    if (canAddConfiguration) {
      onConfirm(selectedConfigId);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedConfigId("");
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add MCP Configuration</DialogTitle>
            <DialogDescription>
              Select a configuration to add to your bundle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Configuration</Label>
              {availableToSelect.length === 0 ? (
                <div className="px-2 py-4 text-sm text-muted-foreground text-center border rounded-md">
                  No configurations available to add
                </div>
              ) : (
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between"
                    >
                      {selectedConfigId ? (
                        <div className="flex items-center gap-2">
                          {(() => {
                            const config = availableToSelect.find(
                              (c) => c.id === selectedConfigId
                            );
                            return (
                              <>
                                {config?.mcp_server?.logo && (
                                  <div className="relative h-4 w-4 shrink-0">
                                    <Image
                                      src={config.mcp_server.logo}
                                      alt=""
                                      fill
                                      className="object-contain rounded-sm"
                                    />
                                  </div>
                                )}
                                <span>{config?.name}</span>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        "Select a configuration..."
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search configurations..." />
                      <CommandList>
                        <CommandEmpty>No configuration found.</CommandEmpty>
                        <CommandGroup>
                          {availableToSelect.map((config) => {
                            const isShared = config.connected_account_ownership === ConnectedAccountOwnership.SHARED;
                            const accountsForConfig = connectedAccounts.filter(
                              account => account.mcp_server_configuration_id === config.id
                            );
                            const hasAccounts = isShared || accountsForConfig.length > 0;

                            return (
                              <CommandItem
                                key={config.id}
                                value={config.name}
                                onSelect={() => {
                                  setSelectedConfigId(
                                    config.id === selectedConfigId ? "" : config.id
                                  );
                                  setOpen(false);
                                }}
                                disabled={!hasAccounts}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2">
                                    {config.mcp_server?.logo && (
                                      <div className="relative h-4 w-4 shrink-0">
                                        <Image
                                          src={config.mcp_server.logo}
                                          alt=""
                                          fill
                                          className="object-contain rounded-sm"
                                        />
                                      </div>
                                    )}
                                    <div className="flex flex-col">
                                      <span className={cn(!hasAccounts && "text-muted-foreground")}>
                                        {config.name}
                                      </span>
                                      {!hasAccounts && (
                                        <span className="text-xs text-destructive">
                                          No connected accounts available
                                        </span>
                                      )}
                                      {isShared && (
                                        <span className="text-xs text-muted-foreground">
                                          Shared account
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {!hasAccounts && (
                                      <AlertTriangle className="h-4 w-4 text-destructive" />
                                    )}
                                    <Check
                                      className={cn(
                                        "h-4 w-4",
                                        selectedConfigId === config.id
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                  </div>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Show warning if no accounts available for individual configuration */}
            {selectedConfig && !isSharedAccount && configAccounts.length === 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This configuration requires an individual connected account, but none are available.
                  Please create a connected account for this configuration first.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!canAddConfiguration}
            >
              Add Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}