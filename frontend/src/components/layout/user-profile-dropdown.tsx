"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useMetaInfo } from "@/components/context/metainfo";
import {
  Settings,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Shield,
  Users,
} from "lucide-react";
import { OrganizationRole } from "@/features/settings/types/organization.types";

export function UserProfileDropdown() {
  const { user, logout, activeOrg, toggleActiveRole, isActingAsRole } =
    useMetaInfo();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const isAdmin = activeOrg?.userRole === OrganizationRole.Admin;

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Failed to logout");
    }
  };

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  // Get initials from user's first name or email
  const getInitials = () => {
    if (user.firstName) {
      return user.firstName.charAt(0).toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  // Get display name
  const getDisplayName = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    return user.email;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-full hover:ring-2 hover:ring-primary/20 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Avatar className="h-9 w-9 transition-transform hover:scale-105">
            <AvatarImage src={user.pictureUrl} alt={getDisplayName()} />
            <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold text-sm">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 shadow-lg" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.pictureUrl} alt={getDisplayName()} />
                <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {getDisplayName()}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Role Switcher - Only visible for admins */}
        {isAdmin && (
          <>
            <div className="px-2 py-2 mr-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                View as
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant={!isActingAsRole ? "secondary" : "ghost"}
                  size="sm"
                  onClick={async () => {
                    if (isActingAsRole) {
                      await toggleActiveRole();
                      toast.success("Switched to Admin view");
                    }
                  }}
                  className="flex-1 h-8 px-2"
                >
                  <Shield className="h-4 w-4" />
                  <span className="text-xs">Admin</span>
                </Button>
                <Button
                  variant={isActingAsRole ? "secondary" : "ghost"}
                  size="sm"
                  onClick={async () => {
                    if (!isActingAsRole) {
                      await toggleActiveRole();
                      toast.success("Switched to Member view");
                    }
                  }}
                  className="flex-1 h-8 px-2"
                >
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Member</span>
                </Button>
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Theme Selector */}
        <div className="px-2 py-2 mr-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Theme
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant={theme === "light" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTheme("light")}
              className="flex-1 h-8 px-1"
            >
              <Sun className="h-4 w-4" />
              <span className="text-xs">Light</span>
            </Button>
            <Button
              variant={theme === "dark" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTheme("dark")}
              className="flex-1 h-8 px-2"
            >
              <Moon className="h-4 w-4" />
              <span className="text-xs">Dark</span>
            </Button>
            <Button
              variant={theme === "system" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTheme("system")}
              className="flex-1 h-8 px-2"
            >
              <Monitor className="h-4 w-4" />
              <span className="text-xs">System</span>
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => handleNavigation("/settings")}
            className="cursor-pointer hover:bg-accent transition-colors duration-150"
          >
            <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10 transition-colors duration-150"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
