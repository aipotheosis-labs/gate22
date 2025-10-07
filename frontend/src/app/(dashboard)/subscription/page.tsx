"use client";

import { PermissionGuard } from "@/components/rbac/permission-guard";
import { SubscriptionSettings } from "@/features/settings/components/subscription-settings";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default function SubscriptionPage() {
  return (
      <PermissionGuard permission={PERMISSIONS.SUBSCRIPTION_PAGE_VIEW}>
        <div className="container mx-auto max-w-5xl px-6 py-8">
          <SubscriptionSettings />
        </div>
    </PermissionGuard>
  );
}
