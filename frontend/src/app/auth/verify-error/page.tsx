"use client";

import { XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

export default function VerifyErrorPage() {
  return (
    <Suspense fallback={null}>
      <VerifyErrorPageContent />
    </Suspense>
  );
}

function VerifyErrorPageContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const normalizedError = error?.toLowerCase() ?? "";

  const getErrorDetails = () => {
    switch (normalizedError) {
      case "invalid_or_expired_token":
      case "invalid or expired token":
      case "invalid or expired email verification token":
      case "invalid email verification token":
      case "invalid_email_verification_token":
        return {
          title: "Verification Link Expired",
          message:
            "This verification link is no longer valid. Please sign up again to receive a new verification email.",
          showSignUp: true,
        };
      case "token_expired":
      case "token expired":
      case "email verification token expired":
      case "email_verification_token_expired":
        return {
          title: "Link Expired",
          message:
            "Your verification link has expired after 24 hours. Please sign up again to receive a new link.",
          showSignUp: true,
        };
      case "token_not_found_or_already_used":
      case "token not found or already used":
      case "email verification token not found or already used":
      case "email_verification_token_not_found":
        return {
          title: "Link Already Used",
          message:
            "This verification link has already been used or doesn't exist. If you've already verified, try signing in.",
          showSignUp: false,
        };
      case "invalid_token_type":
      case "invalid token type":
      case "token_mismatch":
      case "token mismatch":
      case "invalid email verification token type":
      case "email verification token mismatch":
      case "invalid_email_verification_token_type":
      case "email_verification_token_mismatch":
        return {
          title: "Invalid Link",
          message:
            "This verification link appears to be invalid. Please check your email for the correct link.",
          showSignUp: true,
        };
      case "user_not_found":
        return {
          title: "Account Not Found",
          message:
            "We couldn't find an account for this verification link. Please sign up again to create your account.",
          showSignUp: true,
        };
      default:
        return {
          title: "Verification Failed",
          message:
            "We couldn't verify your email address. Please try again or contact support if the issue persists.",
          showSignUp: true,
        };
    }
  };

  const errorDetails = getErrorDetails();

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
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-2xl font-bold tracking-tight">
                {errorDetails.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {errorDetails.message}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {errorDetails.showSignUp ? (
                <>
                  <Button asChild className="w-full h-11">
                    <Link href="/signup">Sign Up Again</Link>
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

                  <Button asChild variant="outline" className="w-full h-11">
                    <Link href="/login">Go to Sign In</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild className="w-full h-11">
                    <Link href="/login">Sign In to Your Account</Link>
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

                  <Button asChild variant="outline" className="w-full h-11">
                    <Link href="/signup">Create New Account</Link>
                  </Button>
                </>
              )}

              <div className="pt-2">
                <p className="text-center text-xs text-muted-foreground">
                  Need help?{" "}
                  <a
                    href="mailto:support@aipolabs.info"
                    className="text-primary hover:underline"
                  >
                    Contact support
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
