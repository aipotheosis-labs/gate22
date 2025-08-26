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
      // Check if user is authenticated
      const token = tokenManager.getAccessToken();
      if (!token) {
        // Try to refresh token
        const refreshedToken = await tokenManager.refreshAccessToken();
        if (!refreshedToken) {
          router.push("/signup");
          return;
        }
      }
      
      // Get user profile
      try {
        const currentToken = tokenManager.getAccessToken();
        if (currentToken) {
          const userProfile = await getProfile(currentToken);
          setUserName(userProfile.name || userProfile.email || "");
        }
      } catch (e) {
        console.error("Failed to load user data:", e);
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
      
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/v1/organizations`, {
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
        throw new Error("Failed to create organization");
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
