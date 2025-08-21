import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function InviteMemberDialog({ 
  open, 
  onOpenChange, 
  onSuccess 
}: InviteMemberDialogProps) {
  const { accessToken, activeOrg } = useMetaInfo();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>(
    OrganizationRole.Admin,
  );
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    setInviting(true);
    try {
      await inviteToOrganization(
        accessToken,
        activeOrg.orgId,
        inviteEmail.trim(),
        inviteRole,
      );
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole(OrganizationRole.Admin);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to invite user:", error);
      toast.error("Failed to send invitation. Please try again.");
    } finally {
      setInviting(false);
    }
  };

  const handleClose = () => {
    if (!inviting) {
      setInviteEmail("");
      setInviteRole(OrganizationRole.Admin);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Email Input Row */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={inviting}
              className="col-span-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !inviting && inviteEmail) {
                  e.preventDefault();
                  handleInvite();
                }
              }}
            />
          </div>

          {/* Role Selection Row */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              Role
            </Label>
            <Select
              value={inviteRole}
              onValueChange={(v) => setInviteRole(v as OrganizationRole)}
              disabled={inviting}
            >
              <SelectTrigger id="role" className="col-span-3">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OrganizationRole.Admin}>
                  Admin
                </SelectItem>
                <SelectItem value="Member">
                  Member
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={inviting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
          >
            {inviting ? "Sending..." : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}