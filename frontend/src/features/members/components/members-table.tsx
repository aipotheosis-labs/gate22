import { useEffect } from "react";
import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import { useOrgMembersTableColumns } from "@/features/members/hooks/use-org-members-table-columns";
import { useOrganizationMembers } from "@/features/members/hooks/use-organization-members";

interface MembersTableProps {
  refreshKey?: number;
}

export function MembersTable({ refreshKey = 0 }: MembersTableProps) {
  const {
    members = [],
    isLoading,
    removeMember,
    refetch,
  } = useOrganizationMembers();

  useEffect(() => {
    if (refreshKey > 0) {
      refetch();
    }
  }, [refreshKey, refetch]);

  const handleRemove = async (userId: string) => {
    removeMember(userId);
  };

  const columns = useOrgMembersTableColumns({
    onRemove: handleRemove,
  });

  if (isLoading) {
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
        initialPageSize: 10,
      }}
    />
  );
}
