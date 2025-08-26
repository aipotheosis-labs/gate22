"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { issueToken, getProfile } from "@/features/auth/api/auth";
import { tokenManager } from "@/lib/token-manager";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Completing sign in...");

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const provider = searchParams.get("provider");

        if (provider === "google") {
          setLoadingMessage("Completing Google sign in...");
        }

        // Wait a moment to ensure cookies are set
        await new Promise((resolve) => setTimeout(resolve, 500));

        // The backend has already processed the OAuth callback and set the refresh token cookie
        // Now we just need to issue an access token using the cookie
        const tokenResponse = await issueToken();
        const token = tokenResponse.token;

        tokenManager.setAccessToken(token);

        const userProfile = await getProfile(token);

        if (
          !userProfile.organizations ||
          userProfile.organizations.length === 0
        ) {
          router.push("/onboarding/organization");
        } else {
          router.push("/mcp-servers");
        }
      } catch (error) {
        console.error("OAuth callback error:", error);
        setError(
          "Failed to complete sign in. Please try again or contact support if the issue persists.",
        );

        setTimeout(() => {
          router.push("/login");
        }, 5000);
      }
    };

    handleOAuthCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen relative">
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]"
        aria-hidden="true"
      />

      <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div className="flex flex-col items-center justify-center space-y-3">
          {error ? (
            <>
              <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Common causes:</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside mt-2">
                  <li>Cookies are disabled in your browser</li>
                  <li>Running on HTTP instead of HTTPS</li>
                  <li>
                    Browser security settings blocking third-party cookies
                  </li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Redirecting to login...
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">{loadingMessage}</h1>
              <Skeleton className="h-[125px] w-[250px] rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen relative">
          <div
            className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]"
            aria-hidden="true"
          />
          <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
            <div className="flex flex-col items-center justify-center space-y-3">
              <h1 className="text-2xl font-semibold">Completing sign in...</h1>
              <Skeleton className="h-[125px] w-[250px] rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
