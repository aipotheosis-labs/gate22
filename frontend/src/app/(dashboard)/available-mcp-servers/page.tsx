"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Search, Loader2, Plus, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { useMCPServerConfigurations } from "@/features/mcp/hooks/use-mcp-servers";
import { Button } from "@/components/ui/button";
import { BundleMCPStepperForm } from "@/features/bundle-mcp/components/bundle-mcp-stepper-form";
import { useCreateMCPServerBundle } from "@/features/bundle-mcp/hooks/use-bundle-mcp";
import { CreateMCPServerBundleInput } from "@/features/bundle-mcp/types/bundle-mcp.types";
import { cn } from "@/lib/utils";
import { useConnectedAccounts } from "@/features/connected-accounts/hooks/use-connected-account";
import { getOwnershipLabel } from "@/utils/configuration-labels";

export default function AvailableMCPServersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedConfigs, setSelectedConfigs] = useState<Set<string>>(
    new Set(),
  );
  const [isCreatingBundle, setIsCreatingBundle] = useState(false);
  const [isBundleDialogOpen, setIsBundleDialogOpen] = useState(false);

  // Fetch MCP configurations available to the member
  const {
    data: configurationsResponse,
    isLoading,
    error,
  } = useMCPServerConfigurations({
    limit: 100,
  });

  const { mutateAsync: createBundle } = useCreateMCPServerBundle();

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedConfigs((prev) => {
      const next = new Set(ids);
      if (next.size === prev.size) {
        let isSame = true;
        for (const id of prev) {
          if (!next.has(id)) {
            isSame = false;
            break;
          }
        }
        if (isSame) {
          return prev;
        }
      }
      return next;
    });
  }, []);

  // Fetch connected accounts for all configurations
  const { data: connectedAccounts = [] } = useConnectedAccounts();

  const configurations = useMemo(
    () => configurationsResponse?.data || [],
    [configurationsResponse?.data],
  );

  // Get unique categories from MCP servers
  const categories = useMemo(() => {
    const allCategories = configurations.flatMap(
      (config) => config.mcp_server?.categories || [],
    );
    return ["all", ...Array.from(new Set(allCategories))].sort();
  }, [configurations]);

  // Filter configurations based on search and category
  const filteredConfigurations = useMemo(() => {
    return configurations.filter((config) => {
      const matchesSearch =
        searchQuery.toLowerCase() === "" ||
        config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        config.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        config.mcp_server?.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        config.mcp_server?.description
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "all" ||
        config.mcp_server?.categories?.includes(selectedCategory);

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, configurations]);

  const handleCardToggle = (configId: string) => {
    setSelectedConfigs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(configId)) {
        newSet.delete(configId);
      } else {
        newSet.add(configId);
      }
      return newSet;
    });
  };

  const handleCreateBundle = async (values: CreateMCPServerBundleInput) => {
    setIsCreatingBundle(true);
    try {
      await createBundle(values);
      setSelectedConfigs(new Set());
      setIsBundleDialogOpen(false);
      router.push("/bundle-mcp");
    } catch (error) {
      console.error("Failed to create bundle:", error);
    } finally {
      setIsCreatingBundle(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Available MCP Servers</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Browse available MCP server configurations and create bundles for
              your AI agents
            </p>
          </div>
          {selectedConfigs.size > 0 && (
            <Button
              variant="default"
              disabled={isCreatingBundle}
              onClick={() => setIsBundleDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Bundle ({selectedConfigs.size} selected)
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search available MCP servers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category === "all" ? "All Categories" : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selection info */}
        {selectedConfigs.size > 0 && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-sm">
            <span className="font-medium">
              {selectedConfigs.size} configuration(s) selected.
            </span>{" "}
            Click the &quot;Create Bundle&quot; button above to bundle them
            together.
          </div>
        )}

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredConfigurations.length} available MCP server
          configurations
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-500">
              Failed to load MCP server configurations. Please try again.
            </p>
          </div>
        )}

        {/* Configuration Cards Grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredConfigurations.map((config) => {
              const isSelected = selectedConfigs.has(config.id);
              const configAccounts = connectedAccounts.filter(
                (account) => account.mcp_server_configuration_id === config.id,
              );
              const requiresAccount = !!config.connected_account_ownership;
              const hasNoAccounts =
                requiresAccount && configAccounts.length === 0;

              return (
                <Card
                  key={config.id}
                  className={cn(
                    "relative group hover:shadow-md transition-all cursor-pointer min-h-[240px]",
                    isSelected && "ring-1 ring-primary bg-primary/5",
                  )}
                  onClick={() => router.push(`/mcp-configuration/${config.id}`)}
                >
                  <div className="flex flex-col h-full">
                    {/* Bundle selector - absolute positioned */}
                    <div className="absolute top-6 right-6 z-10">
                      <button
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all h-[34px] shrink-0",
                          hasNoAccounts
                            ? "opacity-40 cursor-not-allowed bg-button-disabled border-button-disabled-border text-button-disabled-foreground"
                            : isSelected
                              ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary shadow-sm"
                              : "bg-button-outline text-button-outline-foreground border-button-outline-border hover:bg-button-outline-hover hover:shadow-sm",
                        )}
                        disabled={hasNoAccounts}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!hasNoAccounts) {
                            handleCardToggle(config.id);
                          }
                        }}
                        title={
                          hasNoAccounts
                            ? "Setup connected account first"
                            : "Add to bundle"
                        }
                      >
                        <div
                          className={cn(
                            "h-5 w-5 rounded border flex items-center justify-center transition-all",
                            hasNoAccounts
                              ? "bg-button-disabled border-button-disabled-border"
                              : isSelected
                                ? "bg-primary-foreground border-primary-foreground"
                                : "bg-button-outline border-button-outline-border",
                          )}
                        >
                          {isSelected && !hasNoAccounts && (
                            <Check className="h-3 w-3 text-primary" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            !hasNoAccounts &&
                              !isSelected &&
                              "group-hover:text-primary",
                          )}
                        >
                          Bundle
                        </span>
                      </button>
                    </div>

                    {/* Header content */}
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3 mb-2">
                        {config.mcp_server?.logo && (
                          <div className="size-10 shrink-0 flex items-center justify-center">
                            <Image
                              src={config.mcp_server.logo}
                              alt={`${config.mcp_server.name} logo`}
                              width={40}
                              height={40}
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 pr-12">
                          <CardTitle className="text-base font-semibold truncate">
                            {config.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {config.mcp_server?.name}
                          </p>
                        </div>
                      </div>

                      {/* Connected Account Info */}
                      {config.connected_account_ownership && (
                        <div className="mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {getOwnershipLabel(
                                config.connected_account_ownership,
                              )}
                            </Badge>
                            {(() => {
                              if (configAccounts.length > 0) {
                                return (
                                  <span className="text-xs text-green-600">
                                    {configAccounts.length} account
                                    {configAccounts.length > 1 ? "s" : ""}{" "}
                                    available
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="text-xs text-amber-600">
                                    Connect an account to use this MCP
                                  </span>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      )}

                      <CardDescription className="text-sm line-clamp-2 text-muted-foreground">
                        {config.description || config.mcp_server?.description}
                      </CardDescription>
                    </CardHeader>

                    {/* Spacer to push content to bottom */}
                    <div className="flex-1" />

                    {/* Bottom content - fixed height for alignment */}
                    <CardContent className="pt-0 px-6 pb-0">
                      <div className="flex items-end justify-between gap-2 min-h-[28px]">
                        {/* Categories - fixed height container */}
                        <div className="flex flex-wrap gap-1 flex-1 min-w-0 items-end">
                          {config.mcp_server?.categories &&
                          config.mcp_server.categories.length > 0 ? (
                            config.mcp_server.categories.map((category) => (
                              <Badge
                                key={category}
                                variant="secondary"
                                className="text-xs"
                              >
                                {category}
                              </Badge>
                            ))
                          ) : (
                            <div className="h-[22px]" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && filteredConfigurations.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No MCP server configurations available. Please contact your
              administrator to assign MCP servers to your team.
            </p>
          </div>
        )}
      </div>

      {/* Bundle MCP Stepper Form Dialog */}
      <BundleMCPStepperForm
        isOpen={isBundleDialogOpen}
        onClose={() => setIsBundleDialogOpen(false)}
        availableConfigurations={configurations}
        connectedAccounts={connectedAccounts}
        selectedIds={Array.from(selectedConfigs)}
        onSelectionChange={handleSelectionChange}
        onSubmit={handleCreateBundle}
      />
    </div>
  );
}
