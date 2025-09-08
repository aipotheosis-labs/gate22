"use client";

import { Check, ChevronsUpDown, Shield, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { useMetaInfo } from "@/components/context/metainfo";
import { OrganizationRole } from "@/features/settings/types/organization.types";
import { toast } from "sonner";

export const RoleSelector = () => {
  const { activeOrg, toggleActiveRole, activeRole } = useMetaInfo();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isAdmin = activeOrg?.userRole === OrganizationRole.Admin;

  if (!isAdmin) {
    return null;
  }

  const roles = [
    {
      value: "admin",
      label: "View As Admin",
      icon: Shield,
      active: activeRole === OrganizationRole.Admin,
    },
    {
      value: "member",
      label: "View As Member",
      icon: Users,
      active: activeRole === OrganizationRole.Member,
    },
  ];

  const currentRole =
    activeRole === OrganizationRole.Member ? "member" : "admin";
  const currentRoleData = roles.find((role) => role.value === currentRole);

  const handleRoleChange = async (roleValue: string) => {
    if (
      (roleValue === "admin" && activeRole === OrganizationRole.Admin) ||
      (roleValue === "member" && activeRole === OrganizationRole.Member)
    ) {
      setOpen(false);
      return;
    }

    // Toggle the role
    const newActiveRole = await toggleActiveRole();
    const newRole = roleValue === "admin" ? "Admin" : "Member";
    toast.success(`Switched to ${newRole} view`);
    setOpen(false);

    // Navigate to the appropriate page for the new role
    if (newActiveRole === OrganizationRole.Admin) {
      // Now viewing as admin
      router.push("/mcp-servers");
    } else {
      // Now viewing as member
      router.push("/available-mcp-servers");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between h-9 px-3 text-sm font-medium min-w-[140px]"
        >
          <div className="flex items-center gap-2 truncate">
            {currentRoleData && (
              <>
                <currentRoleData.icon className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{currentRoleData.label}</span>
              </>
            )}
          </div>
          <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="end">
        <Command>
          <CommandList>
            <CommandGroup>
              {roles.map((role) => (
                <CommandItem
                  key={role.value}
                  value={role.value}
                  onSelect={handleRoleChange}
                  className="flex justify-between items-center relative"
                >
                  <div className="flex items-center gap-2 w-full">
                    <role.icon className="h-4 w-4 text-muted-foreground" />
                    <div className="grow truncate">{role.label}</div>
                    <Check
                      className={cn(
                        "h-4 w-4",
                        role.active ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
