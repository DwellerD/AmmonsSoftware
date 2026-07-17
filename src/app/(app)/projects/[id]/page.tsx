"use client";

import { useParams } from "next/navigation";
import { ProjectWorkspace } from "@/components/projects/ProjectWorkspace";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  return <ProjectWorkspace projectId={params.id} />;
}
