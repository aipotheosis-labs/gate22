"use client";

import { useState, useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Plus, ExternalLink, Server } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { useMCPServerConfigurations } from "@/features/mcp/hooks/use-mcp-server-configurations";
import { useCreateOAuth2ConnectedAccount } from "@/features/linked-accounts/hooks/use-linked-account";
import { MCPServerConfigurationPublicBasic } from "@/features/mcp/types/mcp.types";

const formSchema = z.object({
  mcpServerConfigurationId: z
    .string()
    .min(1, "MCP Server configuration is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface AddAccountDialogProps {
  onSuccess?: () => void;
}

export function AddAccountDialog({}: AddAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] =
    useState<MCPServerConfigurationPublicBasic | null>(null);

  const {
    data: mcpConfigurationsResponse,
    isLoading: isLoadingConfigurations,
  } = useMCPServerConfigurations();
  const { mutateAsync: createOAuth2Account, isPending: isCreating } =
    useCreateOAuth2ConnectedAccount();

  const mcpConfigurations = useMemo(
    () => mcpConfigurationsResponse?.data || [],
    [mcpConfigurationsResponse],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mcpServerConfigurationId: "",
    },
  });

  const handleSubmit = async (values: FormValues) => {
    try {
      // Automatically generate the redirect URL to return to linked accounts page
      const currentOrigin = window.location.origin;
      const redirectUrl = `${currentOrigin}/linked-accounts`;

      const result = await createOAuth2Account({
        mcpServerConfigurationId: values.mcpServerConfigurationId,
        redirectUrl: redirectUrl,
      });

      if (result.authorization_url) {
        // Redirect to OAuth provider
        window.location.href = result.authorization_url;
      }
    } catch (error) {
      console.error("Error creating connected account:", error);
      toast.error("Failed to create connected account");
    }
  };

  // Update selected config when selection changes
  const watchedConfigId = form.watch("mcpServerConfigurationId");
  useEffect(() => {
    if (watchedConfigId && mcpConfigurations.length > 0) {
      const config = mcpConfigurations.find(
        (c: MCPServerConfigurationPublicBasic) => c.id === watchedConfigId,
      );
      setSelectedConfig(config || null);
    }
  }, [watchedConfigId, mcpConfigurations, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Linked Account</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="mcpServerConfigurationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MCP Server Configuration</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoadingConfigurations}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an MCP server configuration">
                          {selectedConfig && (
                            <div className="flex items-center gap-2">
                              <div className="relative h-5 w-5 shrink-0 flex items-center justify-center">
                                {selectedConfig.mcp_server?.logo ? (
                                  <Image
                                    src={selectedConfig.mcp_server.logo}
                                    alt={`${selectedConfig.mcp_server.name} logo`}
                                    width={20}
                                    height={20}
                                    className="object-contain"
                                  />
                                ) : (
                                  <Server className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <span className="font-medium">
                                {selectedConfig.mcp_server?.name ||
                                  "Unknown Server"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({selectedConfig.id.slice(0, 8)}...)
                              </span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {mcpConfigurations?.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          <div className="flex items-center gap-2 w-full">
                            <div className="relative h-5 w-5 shrink-0 flex items-center justify-center">
                              {config.mcp_server?.logo ? (
                                <Image
                                  src={config.mcp_server.logo}
                                  alt={`${config.mcp_server.name} logo`}
                                  width={20}
                                  height={20}
                                  className="object-contain"
                                />
                              ) : (
                                <Server className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <span className="font-medium">
                              {config.mcp_server?.name || "Unknown Server"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({config.id.slice(0, 8)}...)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the MCP server configuration to link your account
                    with. You will be redirected to authenticate with the
                    provider.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating || !form.watch("mcpServerConfigurationId")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {isCreating ? "Connecting..." : "Connect Account"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
