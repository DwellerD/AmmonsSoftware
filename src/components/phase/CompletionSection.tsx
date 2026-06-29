"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { ErrorAlert, Spinner } from "@/components/ui/States";
import {
  createCompletionRecord,
  listCompletionRecords,
  listPunchItems,
  reviewCompletion,
  uploadCompletionPhotos,
} from "@/lib/api";
import { dispatchNotification } from "@/lib/notifications";
import { COMPLETION_STATUS_STYLES } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/providers/AuthProvider";
import type { CompletionRecord } from "@/lib/database.types";

const MAX_PHOTOS = 8;

/**
 * Completion proof for a trade phase.
 *
 * Contractor submission flow (mobile-first): add a note and attach one or more
 * photos straight from the phone camera or library. Photos upload to Firebase
 * Storage, then the submission metadata is written to Firestore and the phase
 * advances to "Submitted Complete". Past submissions are shown above the form.
 */
export function CompletionSection({
  tradePhaseId,
  projectId,
  phaseTitle,
  onSubmitted,
}: {
  tradePhaseId: string;
  projectId: string;
  phaseTitle?: string;
  /** Called after a successful submission so the parent can refresh status. */
  onSubmitted?: () => void;
}) {
  const [records, setRecords] = useState<CompletionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { canManage } = useAuth();
  // GC review state (per-record).
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Revoke object URLs when previews change/unmount to avoid leaks.
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    const next = [...files, ...picked].slice(0, MAX_PHOTOS);
    previews.forEach((url) => URL.revokeObjectURL(url));
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    // Allow re-selecting the same file later.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    previews.forEach((url) => URL.revokeObjectURL(url));
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  async function approveRecord(record: CompletionRecord) {
    setReviewError(null);
    setReviewingId(record.id);
    try {
      const updated = await reviewCompletion(record.id, {
        trade_phase_id: tradePhaseId,
        project_id: projectId,
        decision: "approve",
      });
      setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
      // Notify the contractor that their submission was approved.
      await dispatchNotification({
        recipientId: record.submitted_by,
        type: "completion_approved",
        relatedEntityType: "trade_phase",
        relatedEntityId: tradePhaseId,
        context: { subject: phaseTitle ?? "this phase" },
      });
      onSubmitted?.();
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Failed to approve completion.",
      );
    } finally {
      setReviewingId(null);
    }
  }

  async function rejectRecord(record: CompletionRecord) {
    if (!rejectNotes.trim()) {
      setReviewError("Add a note describing what needs to be fixed.");
      return;
    }
    setReviewError(null);
    setReviewingId(record.id);
    try {
      const updated = await reviewCompletion(record.id, {
        trade_phase_id: tradePhaseId,
        project_id: projectId,
        decision: "reject",
        notes: rejectNotes.trim(),
      });
      setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
      // Build the rejection detail: review notes plus any related punch items.
      let detail = rejectNotes.trim();
      try {
        const punch = await listPunchItems(tradePhaseId);
        const openPunch = punch.filter(
          (p) => p.status !== "Resolved" && p.status !== "Closed",
        );
        if (openPunch.length > 0) {
          detail += ` ${openPunch.length} open punch item${
            openPunch.length === 1 ? "" : "s"
          } to address.`;
        }
      } catch {
        // Punch lookup is best-effort; the notification still goes out.
      }
      await dispatchNotification({
        recipientId: record.submitted_by,
        type: "completion_rejected",
        relatedEntityType: "trade_phase",
        relatedEntityId: tradePhaseId,
        context: { subject: phaseTitle ?? "this phase", detail },
      });
      setRejectingId(null);
      setRejectNotes("");
      onSubmitted?.();
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Failed to reject completion.",
      );
    } finally {
      setReviewingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() && files.length === 0) {
      setFormError("Add a note or at least one photo.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const photo_urls =
        files.length > 0
          ? await uploadCompletionPhotos(tradePhaseId, files)
          : undefined;
      const created = await createCompletionRecord({
        trade_phase_id: tradePhaseId,
        project_id: projectId,
        notes: note.trim() || undefined,
        photo_urls,
      });
      setRecords((prev) => [...prev, created]);
      setNote("");
      previews.forEach((url) => URL.revokeObjectURL(url));
      setFiles([]);
      setPreviews([]);
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
          <div className="rounded-lg border border-dashed border-ink-200 bg-ink-50/50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-ink-700">
              No completion proof yet
            </p>
            <p className="mt-1 text-xs text-ink-500">
              The contractor can add a note and photos below when the work is
              done.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {records.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-ink-100 bg-ink-50/50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      COMPLETION_STATUS_STYLES[r.status],
                    )}
                  >
                    {r.status}
                  </span>
                  <span className="text-xs text-ink-500">
                    {timeAgo(r.submitted_at)}
                  </span>
                </div>
                {r.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink-800">
                    {r.notes}
                  </p>
                )}
                {r.photo_urls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.photo_urls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt="Completion proof"
                          className="h-20 w-20 rounded-lg border border-ink-200 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-ink-400">
                  Submitted {formatDate(r.submitted_at)}
                </p>
                {r.review_notes && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                    <p className="text-xs font-medium text-amber-800">
                      GC feedback
                      {r.reviewed_at ? ` · ${timeAgo(r.reviewed_at)}` : ""}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-amber-900">
                      {r.review_notes}
                    </p>
                  </div>
                )}

                {canManage && r.status === "Submitted" && (
                  <div className="mt-3 border-t border-ink-100 pt-3">
                    {rejectingId === r.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={rejectNotes}
                          onChange={(e) => setRejectNotes(e.target.value)}
                          placeholder="What needs to be fixed?"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="danger"
                            loading={reviewingId === r.id}
                            onClick={() => rejectRecord(r)}
                          >
                            Send back — needs fix
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectNotes("");
                              setReviewError(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          loading={reviewingId === r.id}
                          onClick={() => approveRecord(r)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRejectingId(r.id);
                            setReviewError(null);
                          }}
                        >
                          Reject / needs fix
                        </Button>
                      </div>
                    )}
                    {reviewError && reviewingId === null && (
                      <p className="mt-2 text-xs text-red-600">{reviewError}</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-3 border-t border-ink-100 pt-4"
        >
          {formError && <ErrorAlert message={formError} />}
          <Field label="Completion note" htmlFor="completion-note">
            <Textarea
              id="completion-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe the finished work…"
            />
          </Field>

          <div>
            <input
              ref={fileInputRef}
              id="completion-photos"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= MAX_PHOTOS}
            >
              {files.length === 0 ? "Add photos" : "Add more photos"}
            </Button>
            <p className="mt-1 text-xs text-ink-500">
              Take a photo or pick from your library (up to {MAX_PHOTOS}).
            </p>

            {previews.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {previews.map((url, i) => (
                  <div key={url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Selected ${i + 1}`}
                      className="h-20 w-20 rounded-lg border border-ink-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      aria-label="Remove photo"
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-xs text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" loading={saving} className="w-full sm:w-auto">
            {saving ? "Uploading…" : "Submit completion"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
