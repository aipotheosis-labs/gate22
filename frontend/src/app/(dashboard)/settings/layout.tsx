"use client";

import { SettingsNavigation } from "@/features/settings/components/settings-navigation";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row gap-8 p-4">
      <aside className="w-full lg:w-40 lg:flex-shrink-0">
        <div className="sticky top-6">
          <h1 className="text-2xl font-bold mb-6 px-3">Settings</h1>
          <SettingsNavigation />
        </div>
      </aside>
      <main className="flex-1 max-w-4xl">{children}</main>
    </div>
  );
}
