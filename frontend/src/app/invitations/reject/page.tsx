"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { tokenManager } from "@/lib/token-manager";
import {
  getInvitation,
  getInvitationByToken,
  getInvitationDetail,
  rejectInvitation,
} from "@/features/invitations/api/invitations";
import {
  OrganizationInvitationDetail,
  OrganizationInvitationStatus,
  PendingInvitationState,
} from "@/features/invitations/types/invitation.types";
import {
  clearPendingInvitation,
  getPendingInvitation,
  storePendingInvitation,
} from "@/features/invitations/utils/pending-invitation";

const STATUS_LABELS: Record<OrganizationInvitationStatus, string> = {
  [OrganizationInvitationStatus.Pending]: "Pending",
  [OrganizationInvitationStatus.Accepted]: "Accepted",
  [OrganizationInvitationStatus.Rejected]: "Rejected",
  [OrganizationInvitationStatus.Canceled]: "Canceled",
};

type StatusBanner = {
  variant: "default" | "destructive";
  title: string;
  description: string;
};

function resolveStatusBanner(
  status: OrganizationInvitationStatus | undefined,
): StatusBanner | null {
  if (!status || status === OrganizationInvitationStatus.Pending) {
    return null;
  }

  switch (status) {
    case OrganizationInvitationStatus.Accepted:
      return {
        variant: "default",
        title: "Invitation already accepted",
        description:
          "This invitation was already accepted. If you meant to leave the organization, ask an admin to update your membership.",
      };
    case OrganizationInvitationStatus.Rejected:
      return {
        variant: "destructive",
        title: "Invitation already declined",
        description:
          "You have already declined this invitation. Request a new invite from the admin if you change your mind.",
      };
    case OrganizationInvitationStatus.Canceled:
      return {
        variant: "destructive",
        title: "Invitation was withdrawn",
        description:
          "The organization admin canceled this invitation. Reach out to them for a new invite.",
      };
    default:
      return {
        variant: "default",
        title: "Invitation status updated",
        description:
          "This invitation is no longer pending. Contact the organization admin if you need assistance.",
      };
  }
}

type AuthState = "checking" | "unauthenticated" | "authenticated";

type InvitationStep = "collect" | "review" | "done";

function formatIsoDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function RejectInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const invitationIdParam = searchParams.get("invitation_id");
  const invitationId =
    invitationIdParam && invitationIdParam.trim().length
      ? invitationIdParam
      : null;
  const token = searchParams.get("token") ?? "";
  const rejectPath = useMemo(() => {
    const params = new URLSearchParams({ token });
    if (invitationId) {
      params.set("invitation_id", invitationId);
    }
    return `/invitations/reject?${params.toString()}`;
  }, [invitationId, token]);

  const hasToken = useMemo(() => Boolean(token.trim().length), [token]);

  const [pendingInvitation, setPendingInvitation] =
    useState<PendingInvitationState | null>(null);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [invitation, setInvitation] =
    useState<OrganizationInvitationDetail | null>(null);
  const [step, setStep] = useState<InvitationStep>("collect");
  const [isFetching, setIsFetching] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const redirectingRef = useRef(false);

  const resolvedInvitationId =
    invitation?.invitation_id ??
    pendingInvitation?.invitationId ??
    invitationId;

  const acceptPath = useMemo(() => {
    const params = new URLSearchParams({ token });
    if (resolvedInvitationId) {
      params.set("invitation_id", resolvedInvitationId);
    }
    return `/invitations/accept?${params.toString()}`;
  }, [resolvedInvitationId, token]);

  const persistPendingInvitation = useCallback(
    (next: PendingInvitationState) => {
      let changed = false;

      setPendingInvitation((prev) => {
        if (
          prev &&
          prev.invitationId === next.invitationId &&
          prev.token === next.token &&
          (prev.organizationId ?? null) === (next.organizationId ?? null)
        ) {
          return prev;
        }

        changed = true;
        return next;
      });

      if (changed) {
        storePendingInvitation(next);
      }
    },
    [setPendingInvitation],
  );

  useEffect(() => {
    if (pendingInvitation) {
      return;
    }

    const stored = getPendingInvitation();

    if (stored) {
      setPendingInvitation(stored);
    }
  }, [pendingInvitation]);

  useEffect(() => {
    if (!hasToken) {
      return;
    }

    const nextPending: PendingInvitationState = {
      invitationId: invitationId ?? pendingInvitation?.invitationId ?? null,
      token,
      organizationId: pendingInvitation?.organizationId ?? null,
    };

    persistPendingInvitation(nextPending);

    if (!pendingInvitation) {
      setStep("collect");
    }
  }, [
    hasToken,
    invitationId,
    pendingInvitation,
    persistPendingInvitation,
    token,
  ]);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      setAuthState("checking");
      try {
        const tokenValue = await tokenManager.getAccessToken();
        if (cancelled) {
          return;
        }

        if (tokenValue) {
          setAccessToken(tokenValue);
          setAuthState("authenticated");
        } else {
          setAccessToken(null);
          setAuthState("unauthenticated");
        }
      } catch (error) {
        console.error("Failed to check authentication", error);
        if (!cancelled) {
          setAccessToken(null);
          setAuthState("unauthenticated");
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authState !== "authenticated" || !pendingInvitation) {
      return;
    }

    let cancelled = false;

    const loadInvitation = async () => {
      setIsFetching(true);
      setLoadError(null);

      try {
        const tokenValue = accessToken ?? (await tokenManager.getAccessToken());

        if (!tokenValue) {
          throw new Error("Authentication required to load invitation");
        }

        let detail: OrganizationInvitationDetail | null = null;

        if (
          pendingInvitation.organizationId &&
          pendingInvitation.invitationId
        ) {
          detail = await getInvitation(
            tokenValue,
            pendingInvitation.organizationId,
            pendingInvitation.invitationId,
          );
        } else if (pendingInvitation.invitationId) {
          detail = await getInvitationDetail(
            tokenValue,
            pendingInvitation.invitationId,
          );
        } else {
          detail = await getInvitationByToken(
            tokenValue,
            pendingInvitation.token,
          );
          if (!detail) {
            if (!cancelled) {
              setLoadError("Failed to load invitation details");
            }
            return;
          }
        }

        if (cancelled) {
          return;
        }

        setInvitation(detail);
        setStep("review");

        if (tokenValue !== accessToken) {
          setAccessToken(tokenValue);
        }

        persistPendingInvitation({
          invitationId: detail.invitation_id,
          token: pendingInvitation.token,
          organizationId: detail.organization_id,
        });
      } catch (error) {
        console.error("Failed to load invitation", error);
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Failed to load invitation details",
          );
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    };

    loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [accessToken, authState, pendingInvitation, persistPendingInvitation]);

  useEffect(() => {
    if (
      authState !== "unauthenticated" ||
      !pendingInvitation ||
      redirectingRef.current
    ) {
      return;
    }

    redirectingRef.current = true;
    router.replace(`/login?next=${encodeURIComponent(rejectPath)}`);
  }, [authState, pendingInvitation, rejectPath, router]);

  const handleReject = async () => {
    if (!pendingInvitation) {
      return;
    }

    setIsRejecting(true);
    setActionError(null);

    try {
      const tokenValue = accessToken ?? (await tokenManager.getAccessToken());

      if (!tokenValue) {
        setAuthState("unauthenticated");
        throw new Error("You need to sign in before rejecting the invitation.");
      }

      const organizationId =
        invitation?.organization_id ?? pendingInvitation.organizationId ?? null;

      if (!organizationId) {
        throw new Error(
          "Invitation is missing organization information. Please refresh the page.",
        );
      }

      const invitationIdValue = resolvedInvitationId;

      if (!invitationIdValue) {
        throw new Error(
          "Invitation details are incomplete. Please reload the invitation link.",
        );
      }

      await rejectInvitation(tokenValue, organizationId, {
        invitation_id: invitationIdValue,
        token: pendingInvitation.token,
      });

      clearPendingInvitation();
      toast.success("Invitation rejected. We've let the team know.");
      setStep("done");

      setTimeout(() => {
        router.push("/mcp-servers");
      }, 800);
    } catch (error) {
      console.error("Failed to reject invitation", error);
      setActionError(
        error instanceof Error
          ? error.message
          : "We could not reject this invitation. Please try again.",
      );
    } finally {
      setIsRejecting(false);
    }
  };

  if (!hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Invitation link is missing information</CardTitle>
            <CardDescription>
              The link you followed does not include all of the required
              parameters. Please open the original email invitation and try
              again, or request a new invitation from the organization admin.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="secondary">
              <Link href="/">Back to home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (authState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Checking your session</CardTitle>
            <CardDescription>
              Please wait while we verify your account status.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authState === "unauthenticated" || step === "collect") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Sign in to respond</CardTitle>
            <CardDescription>
              Sign in with the email that received this invitation. We&apos;ll
              keep the invitation ready once you return.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTitle>Hold tight</AlertTitle>
              <AlertDescription>
                Invitations can only be declined after verifying your identity.
                Once you sign in, you can confirm the decline instantly.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link href={`/login?next=${encodeURIComponent(rejectPath)}`}>
                Sign in
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href={`/signup?next=${encodeURIComponent(rejectPath)}`}>
                Create account
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Unable to load invitation</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/mcp-servers">Go to dashboard</Link>
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-primary" />
              Invitation declined
            </CardTitle>
            <CardDescription>
              We&apos;ve let the organization know. Feel free to explore the
              rest of the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPending = invitation?.status === OrganizationInvitationStatus.Pending;
  const statusBanner = resolveStatusBanner(invitation?.status);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <Card className="max-w-xl w-full">
        <CardHeader>
          <CardTitle>Decline invitation</CardTitle>
          <CardDescription>
            Make sure you&apos;re declining the correct invitation before
            proceeding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFetching ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading invitation details...
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline">
                  {invitation ? STATUS_LABELS[invitation.status] : "Unknown"}
                </Badge>
              </div>
              {isPending && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Organization ID</span>
                  <span className="font-medium">
                    {invitation?.organization_id ??
                      pendingInvitation?.organizationId}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Invited email</span>
                <span className="font-medium break-all">
                  {invitation?.email ?? "(hidden until verified)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium uppercase">
                  {invitation?.role ?? "-"}
                </span>
              </div>
              {invitation?.expires_at && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expires at</span>
                  <span className="font-medium">
                    {formatIsoDate(invitation.expires_at)}
                  </span>
                </div>
              )}
            </div>
          )}

          {actionError && (
            <Alert variant="destructive">
              <AlertTitle>Unable to reject invitation</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          {statusBanner && (
            <Alert variant={statusBanner.variant}>
              <AlertTitle>{statusBanner.title}</AlertTitle>
              <AlertDescription>{statusBanner.description}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        {isPending && (
          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleReject}
              disabled={isRejecting || isFetching}
            >
              {isRejecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject invitation"
              )}
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href={acceptPath}>Go back to accept</Link>
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
