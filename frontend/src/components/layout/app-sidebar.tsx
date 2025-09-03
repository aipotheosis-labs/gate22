"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { HiOutlineServerStack } from "react-icons/hi2";
import { RiSettings3Line } from "react-icons/ri";
import { Link2, Settings2, Package } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/rbac/permissions";

// Export sidebar items so they can be used in header
export const sidebarItems = [
  {
    title: "MCP Servers",
    url: `/mcp-servers`,
    icon: HiOutlineServerStack,
  },
  {
    title: "MCP Configuration",
    url: `/mcp-configuration`,
    icon: Settings2,
  },
  {
    title: "Connected Accounts",
    url: `/connected-accounts`,
    icon: Link2,
  },
  {
    title: "MCP Bundles",
    url: `/bundle-mcp`,
    icon: Package,
  },
  {
    title: "Settings",
    url: "/settings/organization",
    icon: RiSettings3Line,
  },
];

// Add settings routes to be accessible in header
export const settingsItem = {
  title: "Settings",
  url: "/settings/organization",
  icon: RiSettings3Line,
};

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const canViewMCPConfiguration = usePermission(
    PERMISSIONS.MCP_CONFIGURATION_PAGE_VIEW,
  );

  // Filter sidebar items based on permissions
  const filteredSidebarItems = sidebarItems.filter((item) => {
    // Hide MCP Configuration for users without permission
    if (item.title === "MCP Configuration" && !canViewMCPConfiguration) {
      return false;
    }
    return true;
  });

  return (
    <Sidebar collapsible="icon" className="flex flex-col">
      <SidebarHeader className="p-0 flex flex-col gap-0">
        <div
          className={cn(
            "flex items-center px-6 h-[60px]",
            isCollapsed ? "justify-center" : "justify-between gap-2",
          )}
        >
          {!isCollapsed && (
            <div className="h-7 w-auto relative flex items-center justify-center">
              <Image
                src={`/aci-dev-full-logo-${resolvedTheme ?? "light"}-bg.svg`}
                alt="ACI Dev Logo"
                width={150}
                height={28}
                priority
                className="object-contain h-full"
              />
            </div>
          )}
          <SidebarTrigger />
        </div>
        <Separator />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredSidebarItems.map((item) => {
                const isActive =
                  item.title === "Settings"
                    ? pathname.startsWith("/settings")
                    : pathname === item.url || pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild>
                          <Link
                            href={item.url}
                            className={cn(
                              "flex items-center gap-3 px-4 h-9 transition-colors",
                              isCollapsed && "justify-center",
                              isActive &&
                                "bg-primary/10 text-primary font-medium",
                            )}
                          >
                            <item.icon
                              className={cn(
                                "h-5 w-5 shrink-0",
                                isActive && "text-primary",
                              )}
                            />
                            {!isCollapsed && <span>{item.title}</span>}
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          {item.title}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
