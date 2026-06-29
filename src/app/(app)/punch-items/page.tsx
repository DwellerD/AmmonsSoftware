"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { EmptyState, ErrorAlert, LoadingState } from "@/components/ui/States";
import {
  listAllPunchItems,
  listContractors,
  listProjects,
  listTradePhases,
  updatePunchItemStatus,
} from "@/lib/api";
import {
  PUNCH_ITEM_STATUSES,
  PUNCH_ITEM_STATUS_STYLES,
  PUNCH_PRIORITY_STYLES,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  Contractor,
  Project,
  PunchItem,
  PunchItemStatus,
} from "@/lib/database.types";

/**
 * Punch list screen.
 *
 * Shows every punch item across all projects with filters for project, status,
 * and contractor. Status can be updated inline; resolved and closed items stay
 * visible so there's a record of what was fixed. Filtering is in-memory so it
 * feels instant.
 */
export default function PunchItemsPage() {
  const [items, setItems] = useState<PunchItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [phaseNames, setPhaseNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<"" | PunchItemStatus>("");
  const [contractorId, setContractorId] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [punch, p, crews, phases] = await Promise.all([
          listAllPunchItems(),
          listProjects(),
          listContractors(),
          listTradePhases(),
        ]);
        setItems(punch);
        setProjects(p);
        setContractors(crews);
        setPhaseNames(new Map(phases.map((ph) => [ph.id, ph.title])));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load punch items.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const projectNames = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );
  const contractorNames = useMemo(
    () => new Map(contractors.map((c) => [c.id, c.company_name])),
    [contractors],
  );

  const visibleItems = useMemo(
    () =>
      items.filter((i) => {
        if (projectId && i.project_id !== projectId) return false;
        if (status && i.status !== status) return false;
        if (contractorId && i.assigned_contractor_id !== contractorId)
          return false;
        return true;
      }),
    [items, projectId, status, contractorId],
  );

  const openCount = useMemo(
    () =>
      items.filter((i) => i.status !== "Resolved" && i.status !== "Closed")
        .length,
    [items],
  );

  async function handleStatusChange(id: string, next: PunchItemStatus) {
    const previous = items;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: next } : i)),
    );
    try {
      await updatePunchItemStatus(id, next);
    } catch {
      setItems(previous);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Punch list"
        description={`Defects and fixes across every project. ${openCount} open.`}
      />

      {/* Filters */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Select
          aria-label="Filter by project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
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
          onChange={(e) => setStatus(e.target.value as "" | PunchItemStatus)}
        >
          <option value="">All statuses</option>
          {PUNCH_ITEM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by contractor"
          value={contractorId}
          onChange={(e) => setContractorId(e.target.value)}
        >
          <option value="">All contractors</option>
          {contractors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <LoadingState message="Loading punch items…" />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title={
            items.length === 0
              ? "No punch items yet"
              : "No items match these filters"
          }
          description={
            items.length === 0
              ? "Punch items you add from a trade phase will show up here."
              : "Try clearing a filter to see more."
          }
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {visibleItems.map((i) => {
                const closed =
                  i.status === "Resolved" || i.status === "Closed";
                const crew = i.assigned_contractor_id
                  ? (contractorNames.get(i.assigned_contractor_id) ?? null)
                  : null;
                return (
                  <li key={i.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start gap-2">
                      <Link
                        href={`/trade-phases/${i.trade_phase_id}`}
                        className={cn(
                          "min-w-0 flex-1 text-sm font-medium hover:underline",
                          closed ? "text-ink-400 line-through" : "text-ink-900",
                        )}
                      >
                        {i.title}
                      </Link>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          PUNCH_PRIORITY_STYLES[i.priority],
                        )}
                      >
                        {i.priority}
                      </span>
                      <StatusSelect
                        value={i.status}
                        onChange={(value) =>
                          handleStatusChange(i.id, value as PunchItemStatus)
                        }
                      />
                    </div>
                    {i.description && (
                      <p className="mt-1 text-sm text-ink-600">
                        {i.description}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
                      <span>
                        {projectNames.get(i.project_id) ?? "Unknown project"}
                      </span>
                      <span>{phaseNames.get(i.trade_phase_id) ?? "Phase"}</span>
                      {crew && <span>Assigned: {crew}</span>}
                      {i.due_date && <span>Due {formatDate(i.due_date)}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}
    </PageContainer>
  );
}

/** Small status dropdown styled as a colored pill. */
function StatusSelect({
  value,
  onChange,
}: {
  value: PunchItemStatus;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label="Punch item status"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 rounded-lg border border-ink-200 px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30",
        PUNCH_ITEM_STATUS_STYLES[value],
      )}
    >
      {PUNCH_ITEM_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
