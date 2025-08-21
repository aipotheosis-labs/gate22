"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrganizationRole } from "@/features/settings/types/organization.types";
import { inviteToOrganization } from "@/features/settings/api/organization";
import { useMetaInfo } from "@/components/context/metainfo";
import { toast } from "sonner";
import { Plus, Link2 } from "lucide-react";

interface InviteMemberFormProps {
  onSuccess?: () => void;
}

export function InviteMemberForm({ onSuccess }: InviteMemberFormProps) {
  const { accessToken, activeOrg } = useMetaInfo();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>(OrganizationRole.Admin);
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsInviting(true);
    try {
      await inviteToOrganization(
        accessToken,
        activeOrg.orgId,
        email.trim(),
        role
      );
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      setRole(OrganizationRole.Admin);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to invite user:", error);
      toast.error("Failed to send invitation. Please try again.");
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="border rounded-lg bg-card">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium">
            Invite new members by email address
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Link2 className="h-4 w-4 mr-2" />
            Invite Link
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">
              Email Address
            </label>
            <div className="flex gap-3 mt-2">
              <Input
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isInviting}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isInviting && email) {
                    e.preventDefault();
                    handleInvite();
                  }
                }}
              />
              <Select
                value={role}
                onValueChange={(v) => setRole(v as OrganizationRole)}
                disabled={isInviting}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OrganizationRole.Admin}>Admin</SelectItem>
                  <SelectItem value="Member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            disabled
          >
            <Plus className="h-4 w-4 mr-1" />
            Add more
          </Button>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Additional permissions are required to manage{" "}
            <a href="#" className="text-primary hover:underline">
              Team Members
            </a>
          </p>
          <Button onClick={handleInvite} disabled={isInviting || !email.trim()}>
            {isInviting ? "Inviting..." : "Invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}