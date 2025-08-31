"use client";

import { SettingsNavigation } from "@/features/settings/components/settings-navigation";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row h-full">
      <aside className="w-full lg:w-48 lg:flex-shrink-0 lg:border-r p-4">
        <div className="sticky top-4">
          <h1 className="text-2xl font-bold mb-6 px-3">Settings</h1>
          <SettingsNavigation />
        </div>
      </aside>
      <main className="flex-1 max-w-4xl p-4 lg:pl-12">{children}</main>
    </div>
  );
}
