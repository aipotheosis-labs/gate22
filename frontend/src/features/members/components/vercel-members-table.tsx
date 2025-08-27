"use client";

import { useEffect, useState, useMemo } from "react";
import { OrganizationUser } from "@/features/settings/types/organization.types";
import {
  listOrganizationUsers,
  // removeUser, // Kept for potential future use
} from "@/features/settings/api/organization";
import { useMetaInfo } from "@/components/context/metainfo";
import { toast } from "sonner";
// import { useRouter } from "next/navigation"; // Kept for potential future use with handleRemove
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface VercelMembersTableProps {
  refreshKey?: number;
}

export function VercelMembersTable({
  refreshKey = 0,
}: VercelMembersTableProps) {
  const { accessToken, activeOrg } = useMetaInfo();
  // const router = useRouter(); // Kept for potential future use with handleRemove
  const [members, setMembers] = useState<OrganizationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

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

  // Note: handleRemove is kept for potential future use
  // const handleRemove = async (userId: string) => {
  //   try {
  //     await removeUser(accessToken, activeOrg.orgId, userId);
  //     toast.success("Member removed successfully");
  //     fetchMembers();

  //     if (userId === user?.userId) {
  //       router.push("/mcp-servers");
  //     }
  //   } catch {
  //     toast.error("Failed to remove member");
  //   }
  // };

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      if (!member) return false;
      const fullName =
        `${member.first_name || ""} ${member.last_name || ""}`.trim() ||
        member.name ||
        "";
      const matchesSearch =
        fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.user_id?.toLowerCase().includes(searchQuery.toLowerCase());

      // Map backend roles to frontend display
      const displayRole =
        member.role === "admin"
          ? "Admin"
          : member.role === "member"
            ? "Member"
            : member.role;
      const matchesRole = roleFilter === "all" || displayRole === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

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
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <div className="divide-y">
          {filteredMembers.map((member, index) => {
            if (!member) return null;
            const displayName =
              member.first_name && member.last_name
                ? `${member.first_name} ${member.last_name}`
                : member.name || member.first_name || member.user_id;

            return (
              <div
                key={member.user_id || `member-${index}`}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
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
                    {member.role === "admin"
                      ? "Admin"
                      : member.role === "member"
                        ? "Member"
                        : member.role}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
