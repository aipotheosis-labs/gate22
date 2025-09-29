"use client";

import { SettingsNavigation } from "@/features/settings/components/settings-navigation";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="w-full p-4 lg:w-48 lg:flex-shrink-0 lg:border-r">
        <div className="sticky top-4">
          <h1 className="mb-6 px-3 text-2xl font-bold">Settings</h1>
          <SettingsNavigation />
        </div>
      </aside>
      <main className="max-w-4xl flex-1 p-4 lg:pl-12">{children}</main>
    </div>
  );
}
