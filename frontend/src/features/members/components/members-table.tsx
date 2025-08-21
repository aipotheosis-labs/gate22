import { useEffect, useState, useMemo } from "react";
import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import { useOrgMembersTableColumns } from "@/features/members/hooks/use-org-members-table-columns";
import { OrganizationUser } from "@/features/settings/types/organization.types";
import {
  listOrganizationUsers,
  removeUser,
} from "@/features/settings/api/organization";
import { useMetaInfo } from "@/components/context/metainfo";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface MembersTableProps {
  refreshKey?: number;
}

export function MembersTable({ refreshKey = 0 }: MembersTableProps) {
  const { accessToken, activeOrg, user } = useMetaInfo();
  const router = useRouter();
  const [members, setMembers] = useState<OrganizationUser[]>([]);
  const [loading, setLoading] = useState(true);

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

      // If the current user is leaving the organization
      if (userId === user.userId) {
        router.push("/apps");
      }
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const columns = useOrgMembersTableColumns({
    onRemove: handleRemove,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading members...</div>
      </div>
    );
  }

  return (
    <EnhancedDataTable
      columns={columns}
      data={members}
      searchBarProps={{ 
        placeholder: "Search members by name or email...",
      }}
      paginationOptions={{ 
        initialPageIndex: 0, 
        initialPageSize: 10 
      }}
    />
  );
}