"use client";

import { useParams } from "next/navigation";
import { TeamDetailSettings } from "@/features/settings/components/team-detail-settings";

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = params.teamId as string;

  return <TeamDetailSettings teamId={teamId} />;
}
