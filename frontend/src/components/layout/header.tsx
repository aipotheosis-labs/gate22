"use client";

// import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// import { GoBell } from "react-icons/go";
import { BsQuestionCircle, BsDiscord } from "react-icons/bs";
import { Separator } from "@/components/ui/separator";
import { BreadcrumbLinks } from "./BreadcrumbLinks";
import { usePathname } from "next/navigation";
import { OrgSelector } from "./org-selector";
import { RoleSelector } from "./role-selector";
import { UserProfileDropdown } from "./user-profile-dropdown";

export const Header = () => {
  const pathname = usePathname();

  return (
    <header className="flex-shrink-0 bg-background sticky top-0 z-50">
      <div className="flex w-full items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Organization Selector and Breadcrumbs */}
          <div className="flex items-center gap-2">
            <div className="w-44">
              <OrgSelector />
            </div>
            <span className="text-muted-foreground">/</span>
            <BreadcrumbLinks pathname={pathname} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="px-2 h-9">
                <BsQuestionCircle />
                <span>Support</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Support</DialogTitle>
              </DialogHeader>
              <p>
                For support or to report a bug, please email us at
                support@aipolabs.xyz
              </p>
            </DialogContent>
          </Dialog>

          <a
            href="https://discord.gg/bT2eQ2m9vm"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="px-2 h-9">
              <BsDiscord />
              <span>Discord</span>
            </Button>
          </a>

          {/* <Button variant="outline" className="px-2 mx-2">
            <GoBell />
          </Button> */}

          <div className="h-6 w-px bg-border mx-1" />

          <RoleSelector />

          <UserProfileDropdown />
        </div>
      </div>
      <Separator />
    </header>
  );
};
