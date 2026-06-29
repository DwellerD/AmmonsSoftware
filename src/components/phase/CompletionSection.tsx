"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { ErrorAlert, Spinner } from "@/components/ui/States";
import { createCompletionRecord, listCompletionRecords } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { CompletionRecord } from "@/lib/database.types";

/**
 * Completion proof for a trade phase: a contractor submits a note and an
 * optional photo URL. Submitting advances the phase to "Submitted Complete".
 *
 * Note: file uploads (Firebase Storage) are intentionally out of scope for
 * Sprint 2 — we accept a pasted image link to keep things simple.
 */
export function CompletionSection({
  tradePhaseId,
  projectId,
  onSubmitted,
}: {
  tradePhaseId: string;
  projectId: string;
  /** Called after a successful submission so the parent can refresh status. */
  onSubmitted?: () => void;
}) {
  const [records, setRecords] = useState<CompletionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        setRecords(await listCompletionRecords(tradePhaseId));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load completion proof.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tradePhaseId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() && !photoUrl.trim()) {
      setFormError("Add a note or a photo link.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await createCompletionRecord({
        trade_phase_id: tradePhaseId,
        project_id: projectId,
        notes: note.trim() || undefined,
        photo_urls: photoUrl.trim() ? [photoUrl.trim()] : undefined,
      });
      setRecords((prev) => [...prev, created]);
      setNote("");
      setPhotoUrl("");
      onSubmitted?.();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to submit completion proof.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completion proof</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {error && <ErrorAlert message={error} />}

        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : records.length === 0 ? (
          <p className="text-sm text-ink-500">No completion proof submitted yet.</p>
        ) : (
          <ul className="space-y-3">
            {records.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-ink-100 bg-ink-50/50 p-3"
              >
                {r.notes && (
                  <p className="whitespace-pre-wrap text-sm text-ink-800">
                    {r.notes}
                  </p>
                )}
                {r.photo_urls.length > 0 && (
                  <a
                    href={r.photo_urls[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-sm text-brand-600 hover:underline"
                  >
                    View photo
                  </a>
                )}
                <p className="mt-1 text-xs text-ink-500">
                  Submitted {timeAgo(r.submitted_at)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 border-t border-ink-100 pt-4">
          {formError && <ErrorAlert message={formError} />}
          <Field label="Completion note" htmlFor="completion-note">
            <Textarea
              id="completion-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe the finished work…"
            />
          </Field>
          <Field label="Photo link" htmlFor="completion-photo">
            <Input
              id="completion-photo"
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://… (optional)"
            />
          </Field>
          <Button type="submit" size="sm" loading={saving}>
            Submit completion
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
