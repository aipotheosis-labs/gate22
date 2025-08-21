"use client";

import Link from "next/link";
import Image from "next/image";
import { GrAppsRounded } from "react-icons/gr";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { PiStorefront } from "react-icons/pi";
import { RiSettings3Line, RiLinkUnlinkM } from "react-icons/ri";
import { AiOutlineRobot } from "react-icons/ai";
import { } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useMetaInfo } from "@/components/context/metainfo";

// Export sidebar items so they can be used in header
export const sidebarItems = [
  {
    title: "App Store",
    url: `/apps`,
    icon: PiStorefront,
  },
  {
    title: "App Configurations",
    url: `/appconfigs`,
    icon: GrAppsRounded,
  },
  {
    title: "Linked Accounts",
    url: `/linked-accounts`,
    icon: RiLinkUnlinkM,
  },
  {
    title: "Agents",
    url: `/agents`,
    icon: AiOutlineRobot,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: RiSettings3Line,
  },
];

// Add settings routes to be accessible in header
export const settingsItem = {
  title: "Settings",
  url: "/settings",
  icon: RiSettings3Line,
};

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const { logout } = useMetaInfo();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Failed to logout");
    }
  };

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
              {sidebarItems.map((item) => {
                const isActive =
                  pathname === item.url || pathname.startsWith(item.url);
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


      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton asChild>
                  <Button
                    variant="ghost"
                    onClick={handleLogout}
                    className={cn(
                      "flex items-center gap-3 p-4 transition-colors w-full justify-start font-normal hover:bg-destructive/10 hover:text-destructive",
                      isCollapsed && "justify-center",
                    )}
                  >
                    <LogOut
                      className={cn(
                        "h-5 w-5 shrink-0",
                      )}
                    />
                    {!isCollapsed && <span>Logout</span>}
                  </Button>
                </SidebarMenuButton>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  Logout
                </TooltipContent>
              )}
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
