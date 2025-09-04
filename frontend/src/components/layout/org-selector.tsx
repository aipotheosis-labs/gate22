"use client";

import { Check, ChevronsUpDown, Building /* , Plus */ } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  // CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetaInfo } from "@/components/context/metainfo";
// import { CreateOrganizationForm } from "@/features/auth/components/create-organization-form";
// import { createOrganization } from "@/features/settings/api/organization";
// import { toast } from "sonner";
// import { useRouter } from "next/navigation";

export const OrgSelector = () => {
  const { orgs, activeOrg, setActiveOrg /* , accessToken */ } = useMetaInfo();
  const [open, setOpen] = useState(false);
  // const [createDialogOpen, setCreateDialogOpen] = useState(false); // Not supported yet
  // const router = useRouter();

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-9 px-2 text-sm font-medium hover:bg-muted border border-border rounded-md"
          >
            <div className="flex items-center gap-2 truncate">
              <Building className="h-3 w-3 text-muted-foreground shrink-0" />
              {activeOrg ? (
                <span className="truncate">{activeOrg.orgName}</span>
              ) : (
                <Skeleton className="h-3 w-20" />
              )}
            </div>
            <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search organization..."
              className="h-9"
            />
            <CommandList>
              <CommandEmpty>No organization found.</CommandEmpty>
              <CommandGroup>
                {orgs.map((org) => (
                  <CommandItem
                    key={org.orgId}
                    value={org.orgId}
                    onSelect={() => {
                      setActiveOrg(org);
                      setOpen(false);
                    }}
                    className="flex justify-between items-center relative"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <div className="grow truncate">{org.orgName}</div>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          activeOrg?.orgId === org.orgId
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {/* <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setCreateDialogOpen(true);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <span>Create new organization</span>
                </CommandItem>
              </CommandGroup> */}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to collaborate with your team.
            </DialogDescription>
          </DialogHeader>
          <CreateOrganizationForm
            onCreateOrganization={async (name: string) => {
              try {
                await createOrganization(accessToken, name);
                toast.success("Organization created successfully");

                // Close the dialog
                setCreateDialogOpen(false);

                // Refresh the page to get updated orgs list
                router.refresh();
                window.location.reload();
              } catch (error) {
                throw error;
              }
            }}
          />
        </DialogContent>
      </Dialog> */}
    </>
  );
};
