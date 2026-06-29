"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { ErrorAlert, Spinner } from "@/components/ui/States";
import { createInspection, listInspections } from "@/lib/api";
import { INSPECTION_RESULTS, INSPECTION_RESULT_STYLES } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Inspection, InspectionResult } from "@/lib/database.types";

/**
 * GC inspection + approval for a trade phase. Recording an inspection updates
 * the phase status: "Passed" approves it, otherwise it is moved to "Blocked".
 *
 * Only managers (GC / internal team / admin) can record inspections; everyone
 * else sees the read-only history.
 */
export function InspectionSection({
  tradePhaseId,
  projectId,
  onRecorded,
}: {
  tradePhaseId: string;
  projectId: string;
  /** Called after a successful inspection so the parent can refresh status. */
  onRecorded?: () => void;
}) {
  const { canManage } = useAuth();
  const [items, setItems] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<InspectionResult>("Passed");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        setItems(await listInspections(tradePhaseId));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load inspections.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tradePhaseId]);

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const created = await createInspection({
        trade_phase_id: tradePhaseId,
        project_id: projectId,
        result,
        notes: notes.trim() || undefined,
      });
      setItems((prev) => [...prev, created]);
      setResult("Passed");
      setNotes("");
      onRecorded?.();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to record inspection.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inspection &amp; approval</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {error && <ErrorAlert message={error} />}

        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-500">No inspections recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((i) => (
              <li
                key={i.id}
                className="rounded-lg border border-ink-100 bg-ink-50/50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      INSPECTION_RESULT_STYLES[i.result],
                    )}
                  >
                    {i.result}
                  </span>
                  <span className="text-xs text-ink-500">
                    {timeAgo(i.created_at)}
                  </span>
                </div>
                {i.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink-800">
                    {i.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <form
            onSubmit={handleRecord}
            className="space-y-3 border-t border-ink-100 pt-4"
          >
            {formError && <ErrorAlert message={formError} />}
            <Field label="Result" htmlFor="inspection-result">
              <Select
                id="inspection-result"
                value={result}
                onChange={(e) => setResult(e.target.value as InspectionResult)}
              >
                {INSPECTION_RESULTS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes" htmlFor="inspection-notes">
              <Textarea
                id="inspection-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you find? (optional)"
              />
            </Field>
            <Button type="submit" size="sm" loading={saving}>
              Record inspection
            </Button>
          </form>
        ) : (
          <p className="border-t border-ink-100 pt-4 text-xs text-ink-500">
            Only a GC or internal team member can record inspections.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
