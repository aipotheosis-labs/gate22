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
import { MultiSelect } from "@/components/ui/multi-select";
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

  const handleConfigurationChange = (selectedIds: string[]) => {
    setFormData({
      ...formData,
      mcp_server_configuration_ids: selectedIds,
    });
  };

  const multiSelectOptions = availableConfigurations.map((config) => ({
    value: config.id,
    label: config.name,
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
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
                className="w-full"
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
                className="w-full resize-none"
              />
            </div>
            <div className="grid gap-2">
              <Label>MCP Server Configurations</Label>
              <MultiSelect
                options={multiSelectOptions}
                selected={formData.mcp_server_configuration_ids}
                onChange={handleConfigurationChange}
                placeholder="Select configurations to add..."
                searchPlaceholder="Search configurations..."
                emptyText="No configurations found."
                className="w-full"
              />
              {formData.mcp_server_configuration_ids.length === 0 && (
                <p className="text-sm text-destructive">
                  At least one configuration is required
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
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
