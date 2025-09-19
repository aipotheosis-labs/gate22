"use client";

import { useState, useEffect } from "react";
import { defineStepper } from "@stepperize/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ChevronRight, ChevronLeft, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { CreateMCPServerBundleInput } from "@/features/bundle-mcp/types/bundle-mcp.types";
import {
  MCPServerConfigurationPublicBasic,
  ConnectedAccountOwnership,
} from "@/features/mcp/types/mcp.types";
import { ConnectedAccount } from "@/features/connected-accounts/types/connectedaccount.types";
import { ConfigurationSelectionDialog } from "./configuration-selection-dialog";
import { getOwnershipLabel } from "@/utils/configuration-labels";

interface ConfigurationSelection {
  configurationId: string;
}

interface BundleMCPStepperProps {
  isOpen: boolean;
  onClose: () => void;
  availableConfigurations: MCPServerConfigurationPublicBasic[];
  connectedAccounts?: ConnectedAccount[];
  onSubmit: (values: CreateMCPServerBundleInput) => Promise<void>;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

// Define the stepper with two steps
const { useStepper, steps } = defineStepper(
  { id: "details", label: "Bundle Details" },
  { id: "configurations", label: "MCP Configurations" },
);

export function BundleMCPStepperForm({
  isOpen,
  onClose,
  availableConfigurations,
  connectedAccounts = [],
  onSubmit,
  selectedIds,
  onSelectionChange,
}: BundleMCPStepperProps) {
  const stepper = useStepper();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [description, setDescription] = useState("");
  const [selections, setSelections] = useState<ConfigurationSelection[]>([]);
  const [showConfigSelectionDialog, setShowConfigSelectionDialog] =
    useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      stepper.reset();
      setName("");
      setNameError("");
      setDescription("");

      // Initialize selections with configuration IDs only
      const initialSelections =
        selectedIds?.map((id) => ({
          configurationId: id,
        })) || [];

      setSelections(initialSelections);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Handle adding a new configuration to the bundle
  const handleAddConfiguration = (configId: string) => {
    const newSelection: ConfigurationSelection = { configurationId: configId };
    setSelections((prev) => [...prev, newSelection]);

    // Notify parent about selection change
    const newSelectedIds = [
      ...selections.map((s) => s.configurationId),
      configId,
    ];
    onSelectionChange?.(newSelectedIds);
  };

  // Handle removing a configuration from the bundle
  const handleRemoveConfiguration = (configId: string) => {
    setSelections((prev) => prev.filter((s) => s.configurationId !== configId));

    // Notify parent about selection change
    const newSelectedIds = selections
      .filter((s) => s.configurationId !== configId)
      .map((s) => s.configurationId);
    onSelectionChange?.(newSelectedIds);
  };


  // Get available accounts for a configuration
  const getAccountsForConfiguration = (configId: string) => {
    return connectedAccounts.filter(
      (account) => account.mcp_server_configuration_id === configId,
    );
  };

  // Check if a shared account configuration has a valid shared account
  const hasValidSharedAccount = (configId: string) => {
    const config = availableConfigurations.find((c) => c.id === configId);
    if (
      config?.connected_account_ownership === ConnectedAccountOwnership.SHARED
    ) {
      // Check if there's any connected account that is shared for this configuration
      // Shared accounts should have a specific indicator in the connected accounts
      // If no accounts exist for this shared configuration, it means the shared account is not set up
      const sharedAccounts = connectedAccounts.filter(
        (account) => account.mcp_server_configuration_id === configId,
      );
      // If there are no accounts at all for a shared configuration,
      // it means the shared account is not properly set up
      return sharedAccounts.length > 0;
    }
    return false;
  };

  // Step validation
  const isStepValid = (stepId: string) => {
    switch (stepId) {
      case "details":
        return !!name.trim();
      case "configurations":
        return selections.length > 0;
      default:
        return false;
    }
  };

  const canProceed = isStepValid(stepper.current.id);
  const currentStepIndex = steps.findIndex((s) => s.id === stepper.current.id);

  // Handle form submission
  const handleSubmit = async () => {
    // Final validation
    if (!name.trim()) {
      setNameError("Bundle name is required");
      stepper.goTo("details");
      return;
    }

    if (selections.length === 0) {
      stepper.goTo("configurations");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        mcp_server_configuration_ids: selections.map((s) => s.configurationId),
      });
      onClose();
      // Reset form
      setName("");
      setDescription("");
      setSelections([]);
    } catch (error) {
      console.error("Error creating bundle:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b">
            <DialogTitle>Create MCP Bundle</DialogTitle>
            <DialogDescription>
              Create a new MCP server bundle with selected configurations
            </DialogDescription>
          </DialogHeader>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              {stepper.current.id === "details" && (
                <div className="space-y-4">
                  <div className="px-1">
                    <h3 className="text-sm font-medium mb-1">
                      Bundle Information
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Provide a name and description for your bundle
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="px-1 space-y-2">
                      <Label htmlFor="bundle-name">Bundle Name *</Label>
                      <Input
                        id="bundle-name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (nameError) setNameError("");
                        }}
                        placeholder="Enter bundle name"
                        className={nameError ? "border-red-500" : ""}
                        required
                      />
                      {nameError && (
                        <p className="text-xs text-red-500">{nameError}</p>
                      )}
                    </div>
                    <div className="px-1 space-y-2">
                      <Label htmlFor="bundle-description">Description</Label>
                      <Textarea
                        id="bundle-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Enter bundle description (optional)"
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {stepper.current.id === "configurations" && (
                <div className="space-y-4">
                  <div className="px-1">
                    <h3 className="text-sm font-medium mb-1">
                      MCP Server Configurations
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Select configurations to include in your bundle
                    </p>
                  </div>

                  {/* Configuration Selection Table */}
                  <div className="border rounded-lg overflow-x-auto">
                    {selections.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-muted-foreground mb-4">
                          No configurations added yet
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowConfigSelectionDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add MCP Configuration
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[300px]">
                                Configuration
                              </TableHead>
                              <TableHead className="w-[200px]">
                                Connected Account
                              </TableHead>
                              <TableHead className="w-[80px]">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selections.map((selection) => {
                              const config = availableConfigurations.find(
                                (c) => c.id === selection.configurationId,
                              );

                              if (!config) return null;

                              const accounts = getAccountsForConfiguration(
                                config.id,
                              );
                              const isShared =
                                config.connected_account_ownership ===
                                ConnectedAccountOwnership.SHARED;

                              return (
                                <TableRow key={config.id}>
                                  <TableCell>
                                    <div className="flex items-center space-x-3">
                                      <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                          {config.mcp_server?.logo && (
                                            <div className="relative h-5 w-5 shrink-0">
                                              <Image
                                                src={config.mcp_server.logo}
                                                alt=""
                                                fill
                                                className="object-contain rounded-sm"
                                              />
                                            </div>
                                          )}
                                          <span className="font-medium">
                                            {config.name}
                                          </span>
                                        </div>
                                        {config.connected_account_ownership && (
                                          <div className="text-sm text-muted-foreground">
                                            Type:{" "}
                                            {getOwnershipLabel(
                                              config.connected_account_ownership,
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {isShared ? (
                                      <Badge variant="secondary">
                                        Shared Account
                                      </Badge>
                                    ) : (
                                      <div className="text-sm">
                                        {accounts.length > 0 ? (
                                          <span>
                                            {accounts[0].user?.email ||
                                              accounts[0].user?.name ||
                                              "Connected"}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">
                                            No account connected
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        handleRemoveConfiguration(config.id)
                                      }
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>

                        {/* Add More Configuration Button */}
                        <div className="p-3 border-t bg-muted/50">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowConfigSelectionDialog(true)}
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add MCP Configuration
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Selection Summary */}
                  {selections.length > 0 && (
                    <div className="text-sm text-muted-foreground px-1">
                      {selections.length} configuration
                      {selections.length !== 1 ? "s" : ""} selected
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer with navigation */}
          <div className="border-t px-6 py-3 flex-shrink-0">
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (stepper.isFirst) {
                    onClose();
                  } else {
                    stepper.prev();
                  }
                }}
                disabled={isSubmitting}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {stepper.isFirst ? "Cancel" : "Back"}
              </Button>

              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
                {!stepper.isLast ? (
                  <Button
                    size="sm"
                    onClick={() => stepper.next()}
                    disabled={!canProceed}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !canProceed}
                  >
                    {isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create Bundle
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Configuration Selection Dialog */}
      <ConfigurationSelectionDialog
        isOpen={showConfigSelectionDialog}
        onClose={() => setShowConfigSelectionDialog(false)}
        availableConfigurations={availableConfigurations}
        connectedAccounts={connectedAccounts}
        alreadySelectedIds={selections.map((s) => s.configurationId)}
        onConfirm={handleAddConfiguration}
        hasValidSharedAccount={hasValidSharedAccount}
      />
    </>
  );
}
