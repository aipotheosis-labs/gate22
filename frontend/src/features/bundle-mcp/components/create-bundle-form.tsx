"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { CreateMCPServerBundleInput } from "@/features/bundle-mcp/types/bundle-mcp.types";

interface CreateBundleFormProps {
  title: string;
  availableConfigurations: Array<{ id: string; name: string }>;
  onSubmit: (values: CreateMCPServerBundleInput) => Promise<void>;
  children: React.ReactNode;
}

export function CreateBundleForm({
  title,
  availableConfigurations,
  onSubmit,
  children,
}: CreateBundleFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateMCPServerBundleInput>({
    name: "",
    description: "",
    mcp_server_configuration_ids: [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.mcp_server_configuration_ids.length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      setOpen(false);
      setFormData({
        name: "",
        description: "",
        mcp_server_configuration_ids: [],
      });
    } catch (error) {
      console.error("Error creating bundle:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addConfiguration = (configId: string) => {
    if (!formData.mcp_server_configuration_ids.includes(configId)) {
      setFormData({
        ...formData,
        mcp_server_configuration_ids: [
          ...formData.mcp_server_configuration_ids,
          configId,
        ],
      });
    }
  };

  const removeConfiguration = (configId: string) => {
    setFormData({
      ...formData,
      mcp_server_configuration_ids:
        formData.mcp_server_configuration_ids.filter((id) => id !== configId),
    });
  };

  const selectedConfigs = availableConfigurations.filter((config) =>
    formData.mcp_server_configuration_ids.includes(config.id),
  );

  const availableToSelect = availableConfigurations.filter(
    (config) => !formData.mcp_server_configuration_ids.includes(config.id),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Create a new MCP server bundle with selected configurations
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Bundle Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter bundle name"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter bundle description (optional)"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label>MCP Server Configurations</Label>
              {availableToSelect.length > 0 && (
                <Select onValueChange={addConfiguration}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select configurations to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableToSelect.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md">
                {selectedConfigs.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    No configurations selected
                  </span>
                ) : (
                  selectedConfigs.map((config) => (
                    <Badge key={config.id} variant="secondary">
                      {config.name}
                      <button
                        type="button"
                        onClick={() => removeConfiguration(config.id)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              {formData.mcp_server_configuration_ids.length === 0 && (
                <p className="text-sm text-destructive">
                  At least one configuration is required
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !formData.name ||
                formData.mcp_server_configuration_ids.length === 0
              }
            >
              {isSubmitting ? "Creating..." : "Create Bundle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
