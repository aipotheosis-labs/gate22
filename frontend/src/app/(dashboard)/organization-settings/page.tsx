"use client";

import { OrganizationSettings } from "@/features/settings/components/organization-settings";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrganizationSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/organization-settings");
  }, [router]);

  return (
    <div className="container mx-auto max-w-7xl px-6 py-8">
      <OrganizationSettings />
    </div>
  );
}
