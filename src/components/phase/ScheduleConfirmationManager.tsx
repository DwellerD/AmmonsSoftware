"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ErrorAlert } from "@/components/ui/States";
import { requestScheduleConfirmation } from "@/lib/api";
import { dispatchNotification } from "@/lib/notifications";
import { buildActionLinkUrl } from "@/lib/actionLinks";
import { useAuth } from "@/components/providers/AuthProvider";
import type { ScheduleConfirmationStatus } from "@/lib/database.types";

/**
 * GC-side control on the trade phase page to request a schedule confirmation
 * from the assigned contractor. Generates a tokenized action link the GC can
 * copy and send (text/email), records a notification, and shows the current
 * confirmation status.
 */
export function ScheduleConfirmationManager({
  phaseId,
  projectId,
  phaseTitle,
  projectName,
  contractorId,
  contractorName,
  confirmationStatus,
  confirmationNote,
}: {
  phaseId: string;
  projectId: string;
  phaseTitle: string;
  projectName: string | null;
  contractorId: string | null;
  contractorName: string | null;
  confirmationStatus: ScheduleConfirmationStatus | null;
  confirmationNote: string | null;
}) {
  const { canManage } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  async function generate() {
    setGenerating(true);
    setError(null);
    setCopied(false);
    try {
      const link = await requestScheduleConfirmation({
        phaseId,
        projectId,
        contractorId: contractorId as string,
        phaseTitle,
      });
      // Record (and prepare delivery for) the request notification.
      await dispatchNotification({
        recipientId: contractorId,
        type: "schedule_confirmation_requested",
        relatedEntityType: "trade_phase",
        relatedEntityId: phaseId,
        context: { subject: phaseTitle, projectName },
        actionLinkToken: link.token,
      });
      setUrl(buildActionLinkUrl(window.location.origin, link.token));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate the link.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const statusColor =
    confirmationStatus === "Confirmed"
      ? "text-emerald-700"
      : confirmationStatus === "Declined"
        ? "text-rose-700"
        : "text-ink-500";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule confirmation</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-ink-500">Status</span>
          <span className={`font-medium ${statusColor}`}>
            {confirmationStatus ?? "Not requested"}
          </span>
        </div>
        {confirmationStatus === "Declined" && confirmationNote && (
          <p className="rounded-lg bg-rose-50 p-2 text-rose-700">
            “{confirmationNote}”
          </p>
        )}

        {error && <ErrorAlert message={error} />}

        {!contractorId ? (
          <p className="text-ink-500">
            Assign a contractor to this phase before requesting confirmation.
          </p>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              loading={generating}
              onClick={generate}
            >
              Generate confirmation link
            </Button>
            {url && (
              <div className="space-y-2">
                <p className="text-xs text-ink-500">
                  Send this link to {contractorName ?? "the contractor"}:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={url}
                    className="min-w-0 flex-1 truncate rounded-lg border border-ink-200 bg-ink-50 px-2 py-1.5 text-xs text-ink-700"
                  />
                  <Button size="sm" onClick={copy}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
