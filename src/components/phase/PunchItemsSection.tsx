"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ErrorAlert, Spinner } from "@/components/ui/States";
import {
  createPunchItem,
  listContractors,
  listPunchItems,
  updatePunchItemStatus,
} from "@/lib/api";
import {
  PUNCH_ITEM_STATUSES,
  PUNCH_ITEM_STATUS_STYLES,
  PUNCH_PRIORITIES,
  PUNCH_PRIORITY_STYLES,
} from "@/lib/constants";
import { useAuth } from "@/components/providers/AuthProvider";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
// FUTURE FEATURE:
// Contractor self-service punch updates (a tokenized link + assignment
// notification) are disabled for the current GC-focused MVP. The GC manages
// punch items directly. Re-enable createActionLink/dispatchNotification and the
// PunchItemLinkButton when a contractor portal is added back.
// import { createActionLink } from "@/lib/api";
// import { dispatchNotification } from "@/lib/notifications";
// import { PunchItemLinkButton } from "@/components/phase/PunchItemLinkButton";
import type {
  Contractor,
  PunchItem,
  PunchItemStatus,
  PunchPriority,
} from "@/lib/database.types";

/**
 * Punch list for a trade phase: track defects/fixes that must be closed out.
 * GCs create items (title, description, assigned contractor, priority, due
 * date) and move them through Open → In Progress → Resolved → Closed.
 */
export function PunchItemsSection({
  tradePhaseId,
  projectId,
}: {
  tradePhaseId: string;
  projectId: string;
}) {
  const { canManage } = useAuth();

  const [items, setItems] = useState<PunchItem[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [priority, setPriority] = useState<PunchPriority>("Medium");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<PunchItemStatus>("Open");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [punch, crews] = await Promise.all([
          listPunchItems(tradePhaseId),
          canManage ? listContractors() : Promise.resolve([]),
        ]);
        setItems(punch);
        setContractors(crews);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load punch items.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tradePhaseId, canManage]);

  const openCount = items.filter(
    (i) => i.status !== "Resolved" && i.status !== "Closed",
  ).length;

  function contractorName(id: string | null): string | null {
    if (!id) return null;
    return contractors.find((c) => c.id === id)?.company_name ?? null;
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setContractorId("");
    setPriority("Medium");
    setDueDate("");
    setStatus("Open");
    setFormError(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Give the punch item a title.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await createPunchItem({
        trade_phase_id: tradePhaseId,
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        assigned_contractor_id: contractorId || undefined,
        priority,
        due_date: dueDate || undefined,
        status,
      });
      // FUTURE FEATURE:
      // When a contractor was assigned, the app previously generated a
      // tokenized "Punch Item Update" action link and sent the contractor an
      // assignment notification so they could update the item themselves. This
      // contractor self-service flow is disabled for the current GC-focused
      // MVP. Creating the punch item still logs activity for history. Re-enable
      // when a contractor portal is added back:
      //
      // if (created.assigned_contractor_id) {
      //   const link = await createActionLink({
      //     action_type: "Punch Item Update",
      //     related_entity_id: created.id,
      //     contractor_id: created.assigned_contractor_id,
      //     project_id: projectId,
      //   });
      //   await dispatchNotification({
      //     recipientId: created.assigned_contractor_id,
      //     type: "punch_item_assigned",
      //     relatedEntityType: "punch_item",
      //     relatedEntityId: created.id,
      //     context: {
      //       subject: created.title,
      //       dueDate: created.due_date ? formatDate(created.due_date) : null,
      //     },
      //     actionLinkToken: link.token,
      //   });
      // }
      setItems((prev) => [created, ...prev]);
      resetForm();
      setShowForm(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to add punch item.",
      );
    } finally {
      setSaving(false);
    }
  }

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
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Punch list</CardTitle>
        <span className="text-xs text-ink-500">{openCount} open</span>
      </CardHeader>
      <CardBody className="space-y-4">
        {error && <ErrorAlert message={error} />}

        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-500">No punch items yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.map((i) => {
              const closed = i.status === "Resolved" || i.status === "Closed";
              const crew = contractorName(i.assigned_contractor_id);
              return (
                <li key={i.id} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <p
                      className={cn(
                        "min-w-0 flex-1 text-sm font-medium",
                        closed ? "text-ink-400 line-through" : "text-ink-900",
                      )}
                    >
                      {i.title}
                    </p>
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
                    <p className="text-sm text-ink-600">{i.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 text-xs text-ink-400">
                    {crew && <span>Assigned: {crew}</span>}
                    {i.due_date && <span>Due {formatDate(i.due_date)}</span>}
                  </div>
                  {i.contractor_notes && (
                    <p className="rounded bg-ink-50 px-2 py-1 text-xs text-ink-600">
                      Contractor note: {i.contractor_notes}
                    </p>
                  )}
                  {/*
                    FUTURE FEATURE:
                    A per-item "copy contractor update link" button was removed
                    for the current MVP (no contractor self-service). Restore
                    <PunchItemLinkButton /> here with a contractor portal.
                  */}
                </li>
              );
            })}
          </ul>
        )}

        {canManage &&
          (showForm ? (
            <form
              onSubmit={handleAdd}
              className="space-y-3 border-t border-ink-100 pt-4"
            >
              {formError && <ErrorAlert message={formError} />}
              <Field label="Title" htmlFor="punch-title" required>
                <Input
                  id="punch-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Touch up paint in unit 104"
                />
              </Field>
              <Field label="Description" htmlFor="punch-description">
                <Textarea
                  id="punch-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add any detail the contractor needs."
                />
              </Field>
              <Field label="Assigned contractor" htmlFor="punch-contractor">
                <Select
                  id="punch-contractor"
                  value={contractorId}
                  onChange={(e) => setContractorId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Priority" htmlFor="punch-priority">
                  <Select
                    id="punch-priority"
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as PunchPriority)
                    }
                  >
                    {PUNCH_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Due date" htmlFor="punch-due">
                  <Input
                    id="punch-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Status" htmlFor="punch-status">
                <Select
                  id="punch-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PunchItemStatus)}
                >
                  {PUNCH_ITEM_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" loading={saving}>
                  Add punch item
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="border-t border-ink-100 pt-4">
              <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                Add punch item
              </Button>
            </div>
          ))}
      </CardBody>
    </Card>
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
