"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import {
  EmptyState,
  ErrorAlert,
  LoadingState,
} from "@/components/ui/States";
import {
  listMaterialOrders,
  listProjects,
  listTradePhases,
  listTrades,
  type TradeWithContractor,
} from "@/lib/api";
import { TRADE_PHASE_STATUSES } from "@/lib/constants";
import {
  materialReadiness,
  MATERIAL_READINESS_LABELS,
  MATERIAL_READINESS_STYLES,
  type MaterialReadiness,
} from "@/lib/materials";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  MaterialOrder,
  Project,
  TradePhaseStatus,
  TradePhaseWithRelations,
} from "@/lib/database.types";

/**
 * Trade Phase list view.
 *
 * Shows all trade phases with quick filters for project, status, and trade.
 * Filtering happens in memory against the loaded list so it feels instant.
 * Each row links to the trade phase detail page.
 */
export default function TradePhasesPage() {
  const [phases, setPhases] = useState<TradePhaseWithRelations[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [trades, setTrades] = useState<TradeWithContractor[]>([]);
  const [orders, setOrders] = useState<MaterialOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<"" | TradePhaseStatus>("");
  const [tradeId, setTradeId] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [ph, p, t, o] = await Promise.all([
          listTradePhases(),
          listProjects(),
          listTrades(),
          listMaterialOrders(),
        ]);
        setPhases(ph);
        setProjects(p);
        setTrades(t);
        setOrders(o);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load trade phases.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Trades shown in the filter depend on the selected project.
  const tradeOptions = useMemo(
    () =>
      projectId ? trades.filter((t) => t.project_id === projectId) : trades,
    [trades, projectId],
  );

  // Summarize each phase's material orders into a single readiness state.
  const readinessByPhase = useMemo(() => {
    const byPhase = new Map<string, MaterialOrder[]>();
    for (const o of orders) {
      if (!o.trade_phase_id) continue;
      const list = byPhase.get(o.trade_phase_id) ?? [];
      list.push(o);
      byPhase.set(o.trade_phase_id, list);
    }
    const map = new Map<string, MaterialReadiness>();
    for (const [pid, list] of byPhase) map.set(pid, materialReadiness(list));
    return map;
  }, [orders]);

  // Apply the active filters in memory.
  const visiblePhases = useMemo(
    () =>
      phases.filter((p) => {
        if (projectId && p.project_id !== projectId) return false;
        if (status && p.status !== status) return false;
        if (tradeId && p.trade_id !== tradeId) return false;
        return true;
      }),
    [phases, projectId, status, tradeId],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Trade Phases"
        description="The core workflow items you track across every project."
        action={
          <Link href="/trade-phases/new">
            <Button>New trade phase</Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Select
          aria-label="Filter by project"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setTradeId(""); // reset trade filter when project changes
          }}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | TradePhaseStatus)}
        >
          <option value="">All statuses</option>
          {TRADE_PHASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by trade"
          value={tradeId}
          onChange={(e) => setTradeId(e.target.value)}
        >
          <option value="">All trades</option>
          {tradeOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <LoadingState message="Loading trade phases…" />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : visiblePhases.length === 0 ? (
        <EmptyState
          title={
            phases.length === 0
              ? "No trade phases yet"
              : "No phases match these filters"
          }
          description={
            phases.length === 0
              ? "Create your first trade phase to start tracking work."
              : "Try clearing a filter to see more."
          }
          action={
            phases.length === 0 ? (
              <Link href="/trade-phases/new">
                <Button>New trade phase</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {visiblePhases.map((phase) => (
                <li key={phase.id}>
                  <Link
                    href={`/trade-phases/${phase.id}`}
                    className="flex flex-col gap-2 px-5 py-4 hover:bg-ink-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900">
                        {phase.title}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-500">
                        {phase.trade?.name ?? "—"}
                        {phase.contractor
                          ? ` · ${phase.contractor.company_name}`
                          : " · Unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-ink-500">
                        {formatDate(phase.scheduled_start_date)} →{" "}
                        {formatDate(phase.scheduled_end_date)}
                      </span>
                      {(() => {
                        const readiness =
                          readinessByPhase.get(phase.id) ?? "none";
                        if (readiness === "none") return null;
                        return (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                              MATERIAL_READINESS_STYLES[readiness],
                            )}
                          >
                            {MATERIAL_READINESS_LABELS[readiness]}
                          </span>
                        );
                      })()}
                      <StatusBadge status={phase.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </PageContainer>
  );
}
