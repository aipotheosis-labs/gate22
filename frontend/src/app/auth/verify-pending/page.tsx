"use client";

import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function VerifyPendingPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

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
            Back to Home
          </Button>
        </Link>
      </div>

      {/* Main Content */}
      <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="border border-primary/50 bg-background/95 backdrop-blur-sm rounded-lg p-8">
            {/* Mail Icon with Animation */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20">
                  <Mail className="h-8 w-8 text-blue-500" />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-2xl font-bold tracking-tight">
                Check Your Email
              </h1>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>We&apos;ve sent a verification link to</p>
                {email && (
                  <p className="font-medium text-foreground">{email}</p>
                )}
                <p>Click the link in the email to verify your account.</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-lg bg-muted/50 p-4 mb-6">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  Didn&apos;t receive the email?
                </span>{" "}
                Check your spam folder. The email may take a few minutes to
                arrive.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button asChild variant="outline" className="w-full h-11">
                <Link href="/login">Go to Sign In</Link>
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>

              <Button asChild variant="ghost" className="w-full h-11">
                <Link href="/signup">Sign Up with Different Email</Link>
              </Button>
            </div>

            {/* Footer Note */}
            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-center text-muted-foreground">
                The verification link will expire in 24 hours
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
