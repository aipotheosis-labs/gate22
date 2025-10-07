"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PermissionGuard } from "@/components/rbac/permission-guard";
import { Permission, PERMISSIONS } from "@/lib/rbac/permissions";

interface SettingsNavItem {
  title: string;
  href: string;
  permission?: Permission;
}

const settingsNavItems: SettingsNavItem[] = [
  {
    title: "Organization",
    href: "/settings/organization",
  },
  {
    title: "Teams",
    href: "/settings/teams",
  },
  {
    title: "Members",
    href: "/settings/members",
  },
  {
    title: "Subscription",
    href: "/settings/subscription",
    permission: PERMISSIONS.SUBSCRIPTION_PAGE_VIEW,
  },
];

export function SettingsNavigation() {
  const pathname = usePathname();

  return (
    <nav className="w-full space-y-1">
      {settingsNavItems.map((item) => {
        const isActive =
          pathname === item.href || (item.href !== "/settings" && pathname.startsWith(item.href));

        const navItem = (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent",
              isActive
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.title}
          </Link>
        );

        if (item.permission) {
          return (
            <PermissionGuard key={item.href} permission={item.permission}>
              {navItem}
            </PermissionGuard>
          );
        }

        return navItem;
      })}
    </nav>
  );
}
