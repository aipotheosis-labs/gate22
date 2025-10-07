"use client";

import { PermissionGuard } from "@/components/rbac/permission-guard";
import { SubscriptionSettings } from "@/features/settings/components/subscription-settings";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default function SubscriptionSettingsPage() {
  return (
    <PermissionGuard permission={PERMISSIONS.SUBSCRIPTION_PAGE_VIEW}>
      <SubscriptionSettings />
    </PermissionGuard>
  );
}
