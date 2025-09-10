"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { issueToken, getProfile } from "@/features/auth/api/auth";
import { tokenManager } from "@/lib/token-manager";

// Error code mapping to user-friendly messages
const ERROR_MESSAGES: Record<
  string,
  { message: string; redirectPath: string }
> = {
  oauth_error: {
    message: "Authentication failed. Please try again.",
    redirectPath: "/login",
  },
};

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [redirectPath, setRedirectPath] = useState<string>("/login");
  const [loadingMessage, setLoadingMessage] = useState("Completing sign in...");

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Check for error parameters from backend OAuth redirect
      const errorParam = searchParams.get("error");

      if (errorParam) {
        // Map error code to user-friendly message
        const errorInfo = ERROR_MESSAGES[errorParam];
        let path = "/login";

        if (errorInfo) {
          setError(errorInfo.message);
          path = errorInfo.redirectPath;
          setRedirectPath(path);
        } else {
          // Fallback for unknown error codes
          setError("An error occurred during sign in. Please try again.");
          setRedirectPath(path);
        }

        setTimeout(() => {
          router.push(path);
        }, 3000);
        return;
      }

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
      } catch (error: unknown) {
        console.error("OAuth callback error:", error);

        // Parse error message for better user feedback
        const errorMessage = "Failed to complete sign in. Please try again.";
        const path = "/login";

        // No need to check for specific error codes anymore since
        // Google OAuth now handles both new and existing users

        setError(errorMessage);
        setRedirectPath(path);
        setTimeout(() => router.push(path), 3000);
      }
    };

    handleOAuthCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen relative">
      {/* Grid Background */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]"
        aria-hidden="true"
      />

      {/* Back button */}
      <div className="absolute top-6 left-6 z-10">
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-background/80 backdrop-blur-sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      {/* Main Content */}
      <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="border border-primary/50 bg-background/95 backdrop-blur-sm rounded-lg p-8">
            {error ? (
              <>
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight mb-2">
                    Authentication Error
                  </h1>
                  <p className="text-sm text-muted-foreground mb-6">{error}</p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => router.push(redirectPath)}
                    className="w-full h-11"
                  >
                    {redirectPath === "/signup"
                      ? "Go to Sign Up"
                      : "Go to Login"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => router.push("/")}
                    className="w-full h-11"
                  >
                    Back to Home
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center mt-6">
                  Redirecting automatically in 3 seconds...
                </p>
              </>
            ) : (
              <div className="text-center">
                <h1 className="text-2xl font-bold tracking-tight mb-6">
                  {loadingMessage}
                </h1>
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <div className="flex justify-center space-x-2 pt-2">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-2 w-2 rounded-full" />
                  </div>
                </div>
              </div>
            )}
          </div>
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
            <div className="w-full max-w-md">
              <div className="border border-primary/50 bg-background/95 backdrop-blur-sm rounded-lg p-8">
                <div className="text-center">
                  <h1 className="text-2xl font-bold tracking-tight mb-6">
                    Completing sign in...
                  </h1>
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <div className="flex justify-center space-x-2 pt-2">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-2 w-2 rounded-full" />
                    </div>
                  </div>
                </div>
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
