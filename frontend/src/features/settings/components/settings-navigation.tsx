"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface SettingsNavItem {
  title: string
  href: string
}

const settingsNavItems: SettingsNavItem[] = [
  {
    title: "Account",
    href: "/settings"
  },
  {
    title: "Teams",
    href: "/settings/teams"
  },
  {
    title: "Members",
    href: "/settings/members"
  }
]

export function SettingsNavigation() {
  const pathname = usePathname()

  return (
    <nav className="w-full space-y-1">
      {settingsNavItems.map((item) => {
        const isActive = pathname === item.href || 
                        (item.href !== "/settings" && pathname.startsWith(item.href))
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent",
              isActive ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}