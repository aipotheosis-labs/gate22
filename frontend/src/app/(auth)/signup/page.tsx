"use client";

import { useRouter } from "next/navigation";
import { SignupForm } from "@/features/auth/components/signup-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();

  const handleSignup = async (
    email: string,
    password: string,
    name: string,
  ) => {
    // Demo mode - bypass auth and accept any signup
    console.log("Demo signup:", { email, name });

    // Create mock user data for demo
    const mockUser = {
      id: "demo-user-" + Date.now(),
      email: email,
      name: name,
      role: "user",
    };

    // Store mock token and user data
    localStorage.setItem("accessToken", "demo-token-" + Date.now());
    localStorage.setItem("user", JSON.stringify(mockUser));

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Redirect to dashboard
    router.push("/apps");
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
