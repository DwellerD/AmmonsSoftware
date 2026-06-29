"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Field, Select } from "@/components/ui/Field";
import {
  EmptyState,
  ErrorAlert,
  LoadingState,
} from "@/components/ui/States";
import { getTradePhase, updateTradePhaseStatus } from "@/lib/api";
import { TRADE_PHASE_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { MaterialsSection } from "@/components/phase/MaterialsSection";
import { CompletionSection } from "@/components/phase/CompletionSection";
import { PunchItemsSection } from "@/components/phase/PunchItemsSection";
import type {
  TradePhaseStatus,
  TradePhaseWithRelations,
} from "@/lib/database.types";

/**
 * Trade Phase detail page.
 *
 * Shows the full record and lets the GC change the status. Below the overview
 * it surfaces the Sprint 2 workflow tools: material tracking, completion proof,
 * GC inspection/approval, and the punch list.
 */
export default function TradePhaseDetailPage() {
  const params = useParams<{ id: string }>();
  const phaseId = params.id;

  const [phase, setPhase] = useState<TradePhaseWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status update state
  const [status, setStatus] = useState<TradePhaseStatus>("Not Ready");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getTradePhase(phaseId);
        setPhase(data);
        if (data) setStatus(data.status);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load trade phase.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [phaseId]);

  /** Re-fetch the phase without the full-page loading state (after a child
   *  action changes its status, e.g. completion proof or an inspection). */
  async function refreshPhase() {
    try {
      const data = await getTradePhase(phaseId);
      if (data) {
        setPhase(data);
        setStatus(data.status);
      }
    } catch {
      // Non-fatal: the section already showed its own success/failure.
    }
  }

  async function handleSaveStatus() {
    if (!phase || status === phase.status) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updateTradePhaseStatus(phase.id, status);
      setPhase({ ...phase, status: updated.status });
      setSaved(true);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to update status.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <LoadingState message="Loading trade phase…" />
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

  if (!phase) {
    return (
      <PageContainer>
        <EmptyState
          title="Trade phase not found"
          description="This trade phase may have been removed."
          action={
            <Link href="/trade-phases">
              <Button variant="outline">Back to list</Button>
            </Link>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={phase.title}
        description={phase.trade?.name ?? undefined}
        action={
          <Link href="/trade-phases">
            <Button variant="outline">Back to list</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: details */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Overview</CardTitle>
              <StatusBadge status={phase.status} />
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <DetailRow
                label="Project"
                value={
                  phase.project ? (
                    <Link
                      href={`/projects/${phase.project.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {phase.project.name}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow label="Trade" value={phase.trade?.name ?? "—"} />
              <DetailRow
                label="Assigned contractor"
                value={phase.contractor?.company_name ?? "Unassigned"}
              />
              <DetailRow
                label="Scheduled start"
                value={formatDate(phase.scheduled_start_date)}
              />
              <DetailRow
                label="Scheduled end"
                value={formatDate(phase.scheduled_end_date)}
              />
              {phase.description && (
                <div className="pt-2">
                  <p className="text-ink-500">Description</p>
                  <p className="mt-1 whitespace-pre-wrap text-ink-800">
                    {phase.description}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right: status control */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Update status</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {saveError && <ErrorAlert message={saveError} />}
              {saved && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
                  Status saved.
                </div>
              )}
              <Field label="Status" htmlFor="status">
                <Select
                  id="status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as TradePhaseStatus);
                    setSaved(false);
                  }}
                >
                  {TRADE_PHASE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                onClick={handleSaveStatus}
                loading={saving}
                disabled={status === phase.status}
              >
                Save status
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Sprint 2 workflow tools */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-ink-900">Workflow</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <MaterialsSection
            tradePhaseId={phase.id}
            projectId={phase.project_id}
            tradeId={phase.trade_id}
            phaseStatus={phase.status}
            onPhaseStatusChange={refreshPhase}
          />
          <CompletionSection
            tradePhaseId={phase.id}
            projectId={phase.project_id}
            onSubmitted={refreshPhase}
          />
          <PunchItemsSection
            tradePhaseId={phase.id}
            projectId={phase.project_id}
          />
        </div>
      </div>
    </PageContainer>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-800">{value}</span>
    </div>
  );
}
