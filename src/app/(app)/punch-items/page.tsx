"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorAlert, LoadingState } from "@/components/ui/States";
import {
  listAllPunchItems,
  listContractors,
  listProjects,
  listTradePhases,
  updatePunchItem,
  updatePunchItemStatus,
  type UpdatePunchItemInput,
} from "@/lib/api";
import {
  PUNCH_ITEM_STATUSES,
  PUNCH_ITEM_STATUS_STYLES,
  PUNCH_PRIORITIES,
  PUNCH_PRIORITY_STYLES,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/providers/AuthProvider";
import type {
  Contractor,
  Project,
  PunchItem,
  PunchItemStatus,
  PunchPriority,
} from "@/lib/database.types";

interface PunchEditForm {
  title: string;
  description: string;
  assigned_contractor_id: string;
  due_date: string;
  priority: PunchPriority;
  status: PunchItemStatus;
}

/**
 * Punch list screen.
 *
 * Shows every punch item across all projects with filters for project, status,
 * and contractor. Clicking an item opens a details editor on this screen.
 */
export default function PunchItemsPage() {
  const { canManage } = useAuth();
  const [items, setItems] = useState<PunchItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [phaseNames, setPhaseNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<"" | PunchItemStatus>("");
  const [contractorId, setContractorId] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edit, setEdit] = useState<PunchEditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  useEffect(() => {
    if (!selectedItem) {
      setEdit(null);
      return;
    }
    setEdit({
      title: selectedItem.title,
      description: selectedItem.description ?? "",
      assigned_contractor_id: selectedItem.assigned_contractor_id ?? "",
      due_date: selectedItem.due_date ?? "",
      priority: selectedItem.priority,
      status: selectedItem.status,
    });
    setEditError(null);
  }, [selectedItem]);

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
    if (selectedId === id) {
      setEdit((prev) => (prev ? { ...prev, status: next } : prev));
    }
    try {
      await updatePunchItemStatus(id, next);
    } catch {
      setItems(previous);
      if (selectedId === id) {
        const restored = previous.find((item) => item.id === id);
        if (restored) {
          setEdit((prev) => (prev ? { ...prev, status: restored.status } : prev));
        }
      }
    }
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem || !edit) return;
    if (!edit.title.trim()) {
      setEditError("Title is required.");
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      const payload: UpdatePunchItemInput = {
        title: edit.title.trim(),
        description: edit.description.trim() || undefined,
        assigned_contractor_id: edit.assigned_contractor_id || undefined,
        due_date: edit.due_date || undefined,
        priority: edit.priority,
        status: edit.status,
      };
      const saved = await updatePunchItem(selectedItem.id, payload);
      setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
      setEdit({
        title: saved.title,
        description: saved.description ?? "",
        assigned_contractor_id: saved.assigned_contractor_id ?? "",
        due_date: saved.due_date ?? "",
        priority: saved.priority,
        status: saved.status,
      });
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Failed to save punch item.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Punch list"
        description={`Defects and fixes across every project. ${openCount} open.`}
      />

      {selectedItem && edit && (
        <Card className="mb-5">
          <CardBody>
            <form onSubmit={handleSaveDetails} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-ink-900">
                  Punch item details
                </h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedId(null)}
                >
                  Close
                </Button>
              </div>

              {editError && <ErrorAlert message={editError} />}

              <Field label="Title" htmlFor="punch-detail-title" required>
                <Input
                  id="punch-detail-title"
                  value={edit.title}
                  onChange={(e) =>
                    setEdit((prev) =>
                      prev ? { ...prev, title: e.target.value } : prev,
                    )
                  }
                  disabled={!canManage}
                />
              </Field>

              <Field label="Description" htmlFor="punch-detail-description">
                <Textarea
                  id="punch-detail-description"
                  value={edit.description}
                  onChange={(e) =>
                    setEdit((prev) =>
                      prev ? { ...prev, description: e.target.value } : prev,
                    )
                  }
                  disabled={!canManage}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Status" htmlFor="punch-detail-status">
                  <Select
                    id="punch-detail-status"
                    value={edit.status}
                    onChange={(e) =>
                      setEdit((prev) =>
                        prev
                          ? {
                              ...prev,
                              status: e.target.value as PunchItemStatus,
                            }
                          : prev,
                      )
                    }
                    disabled={!canManage}
                  >
                    {PUNCH_ITEM_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Priority" htmlFor="punch-detail-priority">
                  <Select
                    id="punch-detail-priority"
                    value={edit.priority}
                    onChange={(e) =>
                      setEdit((prev) =>
                        prev
                          ? { ...prev, priority: e.target.value as PunchPriority }
                          : prev,
                      )
                    }
                    disabled={!canManage}
                  >
                    {PUNCH_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Due date" htmlFor="punch-detail-due">
                  <Input
                    id="punch-detail-due"
                    type="date"
                    value={edit.due_date}
                    onChange={(e) =>
                      setEdit((prev) =>
                        prev ? { ...prev, due_date: e.target.value } : prev,
                      )
                    }
                    disabled={!canManage}
                  />
                </Field>

                <Field
                  label="Assigned contractor"
                  htmlFor="punch-detail-contractor"
                >
                  <Select
                    id="punch-detail-contractor"
                    value={edit.assigned_contractor_id}
                    onChange={(e) =>
                      setEdit((prev) =>
                        prev
                          ? { ...prev, assigned_contractor_id: e.target.value }
                          : prev,
                      )
                    }
                    disabled={!canManage}
                  >
                    <option value="">Unassigned</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="text-sm text-ink-500">
                <Link
                  href={`/trade-phases/${selectedItem.trade_phase_id}`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  Open trade phase
                </Link>
              </div>

              {canManage && (
                <Button type="submit" loading={saving}>
                  Save punch item
                </Button>
              )}
            </form>
          </CardBody>
        </Card>
      )}

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
                const closed = i.status === "Resolved" || i.status === "Closed";
                const crew = i.assigned_contractor_id
                  ? (contractorNames.get(i.assigned_contractor_id) ?? null)
                  : null;
                return (
                  <li
                    key={i.id}
                    className={cn("px-5 py-4", selectedId === i.id && "bg-brand-50/50")}
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(i.id)}
                        className={cn(
                          "min-w-0 flex-1 text-left text-sm font-medium hover:underline",
                          closed ? "text-ink-400 line-through" : "text-ink-900",
                        )}
                      >
                        {i.title}
                      </button>
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
                      <p className="mt-1 text-sm text-ink-600">{i.description}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
                      <span>{projectNames.get(i.project_id) ?? "Unknown project"}</span>
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
