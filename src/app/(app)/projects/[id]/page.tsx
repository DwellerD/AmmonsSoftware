"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import {
  EmptyState,
  ErrorAlert,
  LoadingState,
} from "@/components/ui/States";
import {
  getProject,
  listTradePhases,
  listTrades,
} from "@/lib/api";
import { ManageUsersSection } from "@/components/projects/ManageUsersSection";
import { PinnedPlansSection } from "@/components/documents/PinnedPlansSection";
import { formatDate } from "@/lib/format";
import type { Project, TradePhaseWithRelations } from "@/lib/database.types";
import type { TradeWithContractor } from "@/lib/api";

/** Detail page for a single project, with its trades and trade phases. */
export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [trades, setTrades] = useState<TradeWithContractor[]>([]);
  const [phases, setPhases] = useState<TradePhaseWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [p, t, ph] = await Promise.all([
          getProject(projectId),
          listTrades(projectId),
          listTradePhases({ projectId }),
        ]);
        setProject(p);
        setTrades(t);
        setPhases(ph);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load project.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  if (loading) {
    return (
      <PageContainer>
        <LoadingState message="Loading project…" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <ErrorAlert message={error} />
      </PageContainer>
    );
  }

  if (!project) {
    return (
      <PageContainer>
        <EmptyState
          title="Project not found"
          description="This project may have been removed."
          action={
            <Link href="/projects">
              <Button variant="outline">Back to projects</Button>
            </Link>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={project.name}
        description={project.location ?? undefined}
        action={
          <Link href="/projects">
            <Button variant="outline">Back to projects</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Project details */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <DetailRow label="Start date" value={formatDate(project.start_date)} />
            <DetailRow
              label="Estimated end"
              value={formatDate(project.estimated_end_date)}
            />
            <DetailRow
              label="Trades"
              value={String(trades.length)}
            />
            <DetailRow
              label="Trade phases"
              value={String(phases.length)}
            />
            {project.notes && (
              <div>
                <p className="text-ink-500">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-ink-800">
                  {project.notes}
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Trade phases for this project */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Trade phases</CardTitle>
            <Link href={`/trade-phases/new?projectId=${project.id}`}>
              <Button size="sm">Add phase</Button>
            </Link>
          </CardHeader>
          <CardBody>
            {phases.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">
                No trade phases for this project yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {phases.map((phase) => (
                  <li key={phase.id}>
                    <Link
                      href={`/trade-phases/${phase.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-ink-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900">
                          {phase.title}
                        </p>
                        <p className="text-xs text-ink-500">
                          {phase.trade?.name ?? "—"}
                          {phase.contractor
                            ? ` · ${phase.contractor.company_name}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={phase.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <ManageUsersSection projectId={project.id} projectName={project.name} />
      </div>

      <div className="mt-6">
        <PinnedPlansSection projectId={project.id} />
      </div>
    </PageContainer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-800">{value}</span>
    </div>
  );
}
