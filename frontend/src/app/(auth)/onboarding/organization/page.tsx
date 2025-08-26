"use client";

import { useRouter } from "next/navigation";
import { CreateOrganizationForm } from "@/features/auth/components/create-organization-form";
import { useEffect, useState } from "react";
import { tokenManager } from "@/lib/token-manager";
import { getProfile } from "@/features/auth/api/auth";

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        // Check if user is authenticated
        let token = tokenManager.getAccessToken();

        if (!token) {
          // Wait a bit for cookies to be available after OAuth redirect
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Try to refresh token
          token = await tokenManager.refreshAccessToken();

          if (!token) {
            // Only redirect to signup if we truly can't get a token
            console.error("No token available, redirecting to signup");
            router.push("/signup");
            return;
          }
        }

        // Get user profile
        const userProfile = await getProfile(token);
        setUserName(userProfile.name || userProfile.email || "");

        // Check if user already has organizations (shouldn't happen but good to check)
        if (userProfile.organizations && userProfile.organizations.length > 0) {
          // User already has an organization, redirect to dashboard
          router.push("/mcp-servers");
        }
      } catch (error) {
        console.error("Failed to load user data:", error);
        // Only redirect on authentication errors
        if (error instanceof Error && error.message.includes("401")) {
          router.push("/signup");
        }
      }
    };

    loadUserInfo();
  }, [router]);

  const handleCreateOrganization = async (name: string) => {
    try {
      const token = await tokenManager.ensureValidToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/v1/organizations/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("API Error:", response.status, errorData);
        throw new Error(
          `Failed to create organization: ${response.statusText}`,
        );
      }

      await response.json();

      // Organization created successfully
      // The MetaInfoProvider will refresh user data on navigation

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Redirect to dashboard
      router.push("/mcp-servers");
    } catch (error) {
      console.error("Error creating organization:", error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Grid Background */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]"
        aria-hidden="true"
      />

      {/* Main Content */}
      <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="border border-primary/50 bg-background/95 backdrop-blur-sm rounded-lg p-8">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight">
                Welcome{userName ? `, ${userName}` : ""}!
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Let&apos;s set up your organization to get started
              </p>
            </div>

            <CreateOrganizationForm
              onCreateOrganization={handleCreateOrganization}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
