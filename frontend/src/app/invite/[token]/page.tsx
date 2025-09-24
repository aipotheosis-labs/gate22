import { redirect } from "next/navigation";

type InvitePageProps = {
  params: { token: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function InviteRedirectPage({
  params,
  searchParams,
}: InvitePageProps): never {
  const rawToken = params.token?.trim();

  if (!rawToken) {
    redirect("/invitations/accept");
  }

  const invitationIdParam = searchParams?.invitation_id;
  const invitationId = Array.isArray(invitationIdParam)
    ? invitationIdParam.at(0)
    : invitationIdParam;
  const normalizedInvitationId =
    invitationId && invitationId.trim().length ? invitationId : null;

  const redirectParams = new URLSearchParams({ token: rawToken });
  if (normalizedInvitationId) {
    redirectParams.set("invitation_id", normalizedInvitationId);
  }

  redirect(`/invitations/accept?${redirectParams.toString()}`);
}
