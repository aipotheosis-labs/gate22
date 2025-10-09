"use client";

import { PermissionGuard } from "@/components/rbac/permission-guard";
import { SubscriptionSettings } from "@/features/settings/components/subscription-settings";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { isSubscriptionEnabled } from "@/lib/feature-flags";
import { notFound } from "next/navigation";

export default function SubscriptionSettingsPage() {
  // Return 404 if subscription features are disabled
  if (!isSubscriptionEnabled()) {
    notFound();
  }

  return (
    <PermissionGuard permission={PERMISSIONS.SUBSCRIPTION_PAGE_VIEW}>
      <SubscriptionSettings />
    </PermissionGuard>
  );
}
