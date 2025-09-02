"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignupForm } from "@/features/auth/components/signup-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  register,
  issueToken,
  getProfile,
  getGoogleRegisterUrl,
} from "@/features/auth/api/auth";
import { tokenManager } from "@/lib/token-manager";

export default function SignupPage() {
  const router = useRouter();
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  const handleSignup = async (
    email: string,
    password: string,
    name: string,
  ) => {
    // Call the real registration API (sets refresh token in cookie)
    const success = await register({
      name,
      email,
      password,
    });

    if (!success) {
      return; // Error is already displayed as toast
    }

    // Issue access token after successful registration
    const tokenResponse = await issueToken();

    // Store token in memory using token manager
    tokenManager.setAccessToken(tokenResponse.token);

    // Get user profile to check if organization exists
    const userProfile = await getProfile(tokenResponse.token);

    // Redirect to organization creation onboarding if no org, otherwise dashboard
    if (!userProfile.organizations || userProfile.organizations.length === 0) {
      router.push("/onboarding/organization");
    } else {
      router.push("/mcp-servers");
    }
  };

  const handleGoogleSignup = () => {
    setIsLoadingGoogle(true);

    // Clear any existing tokens before Google signup to prevent stale token usage
    tokenManager.clearToken();

    // Redirect to the backend OAuth endpoint
    // The backend will handle the redirect to Google
    // Use callback page which will redirect to onboarding for new users
    window.location.href = getGoogleRegisterUrl();
  };

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
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight">
                Create Account
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Start your journey with MCP Gateway
              </p>
            </div>

            <SignupForm onSignup={handleSignup} />

            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-background px-2 text-muted-foreground">
                  Or sign up with
                </span>
              </div>
            </div>

            <div className="mt-4">
              <Button
                variant="outline"
                type="button"
                disabled={isLoadingGoogle}
                className="w-full h-11 transition-all duration-200 hover:bg-accent/50"
                onClick={handleGoogleSignup}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign up with Google
              </Button>
            </div>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">
                Already have an account?{" "}
              </span>
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
