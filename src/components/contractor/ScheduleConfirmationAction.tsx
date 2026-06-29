"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { ErrorAlert, SuccessAlert } from "@/components/ui/States";
import { markActionLinkUsed, setPhaseScheduleConfirmation } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type {
  ContractorActionLink,
  TradePhaseWithRelations,
} from "@/lib/database.types";

/**
 * Contractor-facing schedule confirmation. Shows the scheduled dates for a
 * trade phase and lets the contractor confirm or decline (with an optional
 * reason). Both outcomes update the phase and mark the link as used.
 */
export function ScheduleConfirmationAction({
  link,
  phase,
}: {
  link: ContractorActionLink;
  phase: TradePhaseWithRelations;
}) {
  const [mode, setMode] = useState<"choose" | "declining">("choose");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<"Confirmed" | "Declined" | null>(
    phase.schedule_confirmation_status === "Confirmed" ||
      phase.schedule_confirmation_status === "Declined"
      ? phase.schedule_confirmation_status
      : null,
  );

  async function submit(decision: "Confirmed" | "Declined") {
    setSaving(true);
    setError(null);
    try {
      await setPhaseScheduleConfirmation(
        phase.id,
        decision,
        decision === "Declined" ? reason.trim() : null,
      );
      await markActionLinkUsed(link.token);
      setResult(decision);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-3">
        <SuccessAlert
          message={
            result === "Confirmed"
              ? "Thanks! Your schedule confirmation has been recorded."
              : "Thanks — we've let the team know you can't make these dates."
          }
        />
        <p className="text-sm text-ink-500">
          You can close this page now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-ink-100 bg-ink-50 p-4 text-sm">
        <p className="font-medium text-ink-900">{phase.title}</p>
        <p className="text-ink-600">
          {phase.project?.name ?? "Project"}
          {phase.trade?.name ? ` · ${phase.trade.name}` : ""}
        </p>
        <dl className="mt-3 space-y-1">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">Start</dt>
            <dd className="font-medium text-ink-800">
              {phase.scheduled_start_date
                ? formatDate(phase.scheduled_start_date)
                : "TBD"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">End</dt>
            <dd className="font-medium text-ink-800">
              {phase.scheduled_end_date
                ? formatDate(phase.scheduled_end_date)
                : "TBD"}
            </dd>
          </div>
        </dl>
      </div>

      {error && <ErrorAlert message={error} />}

      {mode === "choose" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1"
            loading={saving}
            onClick={() => submit("Confirmed")}
          >
            Confirm these dates
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={saving}
            onClick={() => setMode("declining")}
          >
            Can&apos;t make it
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Reason (optional)" htmlFor="decline-reason">
            <Textarea
              id="decline-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Let the team know why these dates don't work."
            />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="danger"
              className="flex-1"
              loading={saving}
              onClick={() => submit("Declined")}
            >
              Submit decline
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              disabled={saving}
              onClick={() => setMode("choose")}
            >
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
