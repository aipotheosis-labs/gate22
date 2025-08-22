"use client";

import { useEffect, useState, useMemo } from "react";
import { OrganizationUser } from "@/features/settings/types/organization.types";
import {
  listOrganizationUsers,
  removeUser,
} from "@/features/settings/api/organization";
import { useMetaInfo } from "@/components/context/metainfo";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface VercelMembersTableProps {
  refreshKey?: number;
}

export function VercelMembersTable({
  refreshKey = 0,
}: VercelMembersTableProps) {
  const { accessToken, activeOrg, user } = useMetaInfo();
  const router = useRouter();
  const [members, setMembers] = useState<OrganizationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const fetchMembers = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const data = await listOrganizationUsers(accessToken, activeOrg.orgId);
        setMembers(data);
      } catch {
        toast.error("Failed to load organization members");
      } finally {
        setLoading(false);
      }
    },
    [accessToken, activeOrg.orgId],
  );

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers, refreshKey]);

  const handleRemove = async (userId: string) => {
    try {
      await removeUser(accessToken, activeOrg.orgId, userId);
      toast.success("Member removed successfully");
      fetchMembers();

      if (userId === user?.userId) {
        router.push("/mcp-servers");
      }
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      if (!member) return false;
      const fullName =
        `${member.first_name || ""} ${member.last_name || ""}`.trim();
      const matchesSearch =
        fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.user_id?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMembers(filteredMembers.map((m) => m.user_id));
    } else {
      setSelectedMembers([]);
    }
  };

  const handleSelectMember = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedMembers([...selectedMembers, userId]);
    } else {
      setSelectedMembers(selectedMembers.filter((id) => id !== userId));
    }
  };

  const getInitials = (
    firstName?: string,
    lastName?: string,
    email?: string,
  ) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "??";
  };

  const getAvatarColor = (userId?: string) => {
    const colors = [
      "bg-pink-500",
      "bg-green-500",
      "bg-blue-500",
      "bg-purple-500",
      "bg-orange-500",
    ];
    if (!userId || userId.length === 0) {
      return colors[0]; // Default to first color if no userId
    }
    const index = userId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading members...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Team Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Team Roles</SelectItem>
            <SelectItem value="Admin">Admin</SelectItem>
            <SelectItem value="Member">Member</SelectItem>
            <SelectItem value="Owner">Owner</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <div className="p-4 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={
                selectedMembers.length === filteredMembers.length &&
                filteredMembers.length > 0
              }
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-muted-foreground">
              Select all ({filteredMembers.length})
            </span>
          </div>
        </div>

        <div className="divide-y">
          {filteredMembers.map((member, index) => {
            if (!member) return null;
            const displayName =
              member.first_name && member.last_name
                ? `${member.first_name} ${member.last_name}`
                : member.first_name || member.user_id;

            return (
              <div
                key={member.user_id || `member-${index}`}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedMembers.includes(member.user_id)}
                    onCheckedChange={(checked) =>
                      handleSelectMember(member.user_id, checked as boolean)
                    }
                  />
                  <Avatar className="h-10 w-10">
                    <AvatarFallback
                      className={`${getAvatarColor(member.user_id)} text-white`}
                    >
                      {getInitials(
                        member.first_name,
                        member.last_name,
                        member.email,
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{displayName}</div>
                    <div className="text-sm text-muted-foreground">
                      {member.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {member.role}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    disabled={member.role === "Owner"}
                  >
                    Manage Access
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleRemove(member.user_id)}
                        className="text-destructive"
                        disabled={member.role === "Owner"}
                      >
                        {member.user_id === user?.userId
                          ? "Leave Organization"
                          : "Remove Member"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
