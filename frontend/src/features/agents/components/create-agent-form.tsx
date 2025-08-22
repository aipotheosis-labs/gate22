"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/ui-extensions/multi-select";

const createAgentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  allowed_apps: z.array(z.string()).optional(),
  custom_instructions: z.record(z.string(), z.string()).optional(),
});

type CreateAgentFormValues = z.infer<typeof createAgentSchema>;

interface CreateAgentFormProps {
  title: string;
  validAppNames: string[];
  onSubmit: (values: CreateAgentFormValues) => Promise<void>;
  children: React.ReactNode;
}

export function CreateAgentForm({
  title,
  validAppNames,
  onSubmit,
  children,
}: CreateAgentFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateAgentFormValues>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      allowed_apps: [],
      custom_instructions: {},
    },
  });

  const handleSubmit = async (values: CreateAgentFormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      setOpen(false);
      form.reset();
    } catch (error) {
      console.error("Error creating agent:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Create a new agent with specific permissions and instructions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Agent" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this agent does..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allowed_apps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allowed Apps</FormLabel>
                  <FormControl>
                    <MultiSelect
                      value={field.value || []}
                      onValueChange={field.onChange}
                    >
                      <MultiSelectTrigger>
                        <MultiSelectValue placeholder="Select apps (leave empty for all)" />
                      </MultiSelectTrigger>
                      <MultiSelectContent>
                        {validAppNames.map((app) => (
                          <MultiSelectItem key={app} value={app}>
                            {app}
                          </MultiSelectItem>
                        ))}
                      </MultiSelectContent>
                    </MultiSelect>
                  </FormControl>
                  <FormDescription>
                    Choose which apps this agent can access. Leave empty to
                    allow all apps.
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Agent"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
