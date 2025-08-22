"use client";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MetaInfoProvider } from "@/components/context/metainfo";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 60_000,
      refetchIntervalInBackground: true,
      staleTime: 5 * 60_000,
      gcTime: 15 * 60_000,
      placeholderData: (prev: unknown) => prev,
    },
  },
});

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-full">
      <QueryClientProvider client={queryClient}>
        <MetaInfoProvider>
          <SidebarProvider className="h-full">
            <AppSidebar />
            <SidebarInset className="flex flex-col h-full overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </MetaInfoProvider>
        <Footer />
        <ReactQueryDevtools initialIsOpen={false} />
        <Toaster
          richColors
          position="bottom-right"
          duration={3000}
          toastOptions={{
            style: {
              background: "var(--background)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            },
            className: "group",
            classNames: {
              toast: "group-[.toaster]:shadow-lg",
            },
          }}
        />
      </QueryClientProvider>
    </div>
  );
}
