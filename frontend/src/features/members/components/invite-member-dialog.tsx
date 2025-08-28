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
import { useOrganizationMembers } from "@/features/members/hooks/use-organization-members";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  onSuccess,
}: InviteMemberDialogProps) {
  const { inviteMemberAsync, isInviting } = useOrganizationMembers();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("admin");

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

    try {
      await inviteMemberAsync({
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteRole("admin");
      onSuccess?.();
    } catch {
      // Error handling is done in the hook
    }
  };

  const handleClose = () => {
    if (!isInviting) {
      setInviteEmail("");
      setInviteRole("admin");
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
              disabled={isInviting}
              className="col-span-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isInviting && inviteEmail) {
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
              onValueChange={setInviteRole}
              disabled={isInviting}
            >
              <SelectTrigger id="role" className="col-span-3">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isInviting}>
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={isInviting || !inviteEmail.trim()}
          >
            {isInviting ? "Sending..." : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
