"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ErrorAlert, Spinner } from "@/components/ui/States";
import { createPunchItem, listPunchItems, updatePunchItemStatus } from "@/lib/api";
import { PUNCH_ITEM_STATUSES, PUNCH_ITEM_STATUS_STYLES } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { PunchItem, PunchItemStatus } from "@/lib/database.types";

/**
 * Punch list for a trade phase: track defects/fixes that must be closed out.
 * Add items and move them through Open → In Progress → Resolved.
 */
export function PunchItemsSection({
  tradePhaseId,
  projectId,
}: {
  tradePhaseId: string;
  projectId: string;
}) {
  const [items, setItems] = useState<PunchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        setItems(await listPunchItems(tradePhaseId));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load punch items.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tradePhaseId]);

  const openCount = items.filter(
    (i) => i.status !== "Resolved" && i.status !== "Closed",
  ).length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setFormError("Describe the punch item.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await createPunchItem({
        trade_phase_id: tradePhaseId,
        project_id: projectId,
        title: description.trim(),
      });
      setItems((prev) => [...prev, created]);
      setDescription("");
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
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 py-2">
                <p
                  className={cn(
                    "min-w-0 flex-1 text-sm",
                    i.status === "Resolved"
                      ? "text-ink-400 line-through"
                      : "text-ink-800",
                  )}
                >
                  {i.title}
                </p>
                <Select
                  value={i.status}
                  onChange={(value) =>
                    handleStatusChange(i.id, value as PunchItemStatus)
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="space-y-3 border-t border-ink-100 pt-4">
          {formError && <ErrorAlert message={formError} />}
          <Field label="New punch item" htmlFor="punch-description">
            <Input
              id="punch-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Touch up paint in unit 104"
            />
          </Field>
          <Button type="submit" size="sm" loading={saving}>
            Add punch item
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

/** Small status dropdown styled as a colored pill. */
function Select({
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
