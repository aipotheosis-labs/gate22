"use client";

import { useState, useMemo } from "react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Plus, ExternalLink, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useMCPServerConfigurations } from "@/features/mcp/hooks/use-mcp-servers";
import { useCreateOAuth2ConnectedAccount } from "@/features/connected-accounts/hooks/use-connected-account";
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
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] =
    useState<MCPServerConfigurationPublicBasic | null>(null);

  const {
    data: mcpConfigurationsResponse,
    isLoading: isLoadingConfigurations,
  } = useMCPServerConfigurations({ limit: 100 });
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
      // Automatically generate the redirect URL to return to connected accounts page
      const currentOrigin = window.location.origin;
      const redirectUrl = `${currentOrigin}/connected-accounts`;

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
          <DialogTitle>Add Connected Account</DialogTitle>
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
                <FormItem className="flex flex-col">
                  <FormLabel>MCP Server Configuration</FormLabel>
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={comboboxOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground",
                          )}
                          disabled={isLoadingConfigurations}
                        >
                          {selectedConfig ? (
                            <div className="flex items-center gap-2">
                              {selectedConfig.mcp_server?.logo && (
                                <div className="relative h-4 w-4 shrink-0">
                                  <Image
                                    src={selectedConfig.mcp_server.logo}
                                    alt=""
                                    fill
                                    className="object-contain rounded-sm"
                                  />
                                </div>
                              )}
                              <span>
                                {selectedConfig.name || "Unknown Configuration"}
                              </span>
                            </div>
                          ) : (
                            "Select configuration..."
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search configurations..."
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>No configuration found.</CommandEmpty>
                          <CommandGroup>
                            {mcpConfigurations?.map((config) => (
                              <CommandItem
                                key={config.id}
                                value={config.name || config.id}
                                onSelect={() => {
                                  field.onChange(config.id);
                                  setSelectedConfig(config);
                                  setComboboxOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-2 flex-1">
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
                                  <span>
                                    {config.name || "Unknown Configuration"}
                                  </span>
                                </div>
                                <Check
                                  className={cn(
                                    "ml-auto h-4 w-4",
                                    field.value === config.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
