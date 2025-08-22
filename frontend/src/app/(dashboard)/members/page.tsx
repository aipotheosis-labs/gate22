"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UserPlus } from "lucide-react";
import { VercelMembersTable } from "@/features/members/components/vercel-members-table";
import { InviteMemberDialog } from "@/features/members/components/invite-member-dialog";

export default function MembersPage() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("team-members");

  const handleInviteSuccess = () => {
    setInviteDialogOpen(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="container mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-semibold">Members</h1>
        <Button onClick={() => setInviteDialogOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Invite Member
        </Button>
      </div>
      <p className="text-muted-foreground mb-8">
        Manage team members and invitations
      </p>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-fit grid-cols-2 mb-6">
          <TabsTrigger value="team-members">Team Members</TabsTrigger>
          <TabsTrigger value="pending">Pending Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="team-members" className="mt-0">
          <VercelMembersTable refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="pending" className="mt-0">
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            No pending invitations
          </div>
        </TabsContent>
      </Tabs>

      {/* Invite Member Dialog */}
      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}
