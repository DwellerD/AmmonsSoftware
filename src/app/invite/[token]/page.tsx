"use client";

import { useParams } from "next/navigation";
import { ProjectInviteClient } from "@/components/projects/ProjectInviteClient";

/**
 * Public project invite page. The token in the URL is enough to load the invite;
 * signing in with the invited email address is required to accept it.
 */
export default function ProjectInvitePage() {
  const params = useParams<{ token: string }>();
  return <ProjectInviteClient token={params.token} />;
}
