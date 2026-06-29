"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { ErrorAlert, SuccessAlert } from "@/components/ui/States";
import { applyContractorPunchUpdate, markActionLinkUsed } from "@/lib/api";
import { PUNCH_PRIORITY_STYLES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { allowsRepeatAccess } from "@/lib/actionLinks";
import type { ContractorActionLink, PunchItem } from "@/lib/database.types";

/**
 * Contractor-facing punch item update. Shows the item details and lets the
 * contractor leave a note and mark it In Progress or Resolved. Saves to
 * Firestore and (for one-time links) marks the link used.
 */
export function PunchItemUpdateAction({
  link,
  item,
}: {
  link: ContractorActionLink;
  item: PunchItem;
}) {
  const [note, setNote] = useState(item.contractor_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"In Progress" | "Resolved" | null>(null);

  async function submit(status: "In Progress" | "Resolved") {
    setSaving(true);
    setError(null);
    try {
      await applyContractorPunchUpdate(item.id, status, note);
      // Punch item links allow repeat access, so only resolving closes them out.
      if (!allowsRepeatAccess(link.action_type) || status === "Resolved") {
        await markActionLinkUsed(link.token);
      }
      setDone(status);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-3">
        <SuccessAlert
          message={
            done === "Resolved"
              ? "Thanks! This item has been marked resolved."
              : "Thanks! We've marked this item in progress and saved your note."
          }
        />
        <p className="text-sm text-ink-500">You can close this page now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-ink-100 bg-ink-50 p-4 text-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-ink-900">{item.title}</p>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              PUNCH_PRIORITY_STYLES[item.priority],
            )}
          >
            {item.priority}
          </span>
        </div>
        {item.description && (
          <p className="mt-2 whitespace-pre-wrap text-ink-700">
            {item.description}
          </p>
        )}
        <dl className="mt-3 space-y-1">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">Current status</dt>
            <dd className="font-medium text-ink-800">{item.status}</dd>
          </div>
          {item.due_date && (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Due</dt>
              <dd className="font-medium text-ink-800">
                {formatDate(item.due_date)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {error && <ErrorAlert message={error} />}

      <Field label="Add a note (optional)" htmlFor="punch-note">
        <Textarea
          id="punch-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe what you did or what's still needed."
        />
      </Field>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="flex-1"
          loading={saving}
          onClick={() => submit("In Progress")}
        >
          Mark in progress
        </Button>
        <Button
          className="flex-1"
          loading={saving}
          onClick={() => submit("Resolved")}
        >
          Mark resolved
        </Button>
      </div>
    </div>
  );
}
