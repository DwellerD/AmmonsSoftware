"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createActionLink } from "@/lib/api";
import { buildActionLinkUrl } from "@/lib/actionLinks";

/**
 * FUTURE FEATURE:
 * This control is intentionally not rendered in the current MVP (no contractor
 * self-service). It is preserved for a later version with a contractor portal.
 *
 * GC-side control to generate a Punch Item Update link for the assigned
 * contractor. Renders inline within a punch item row. Disabled (hidden) when
 * there is no contractor to send it to.
 */
export function PunchItemLinkButton({
  punchItemId,
  projectId,
  contractorId,
}: {
  punchItemId: string;
  projectId: string;
  contractorId: string | null;
}) {
  const [generating, setGenerating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!contractorId) return null;

  async function generate() {
    setGenerating(true);
    setError(null);
    setCopied(false);
    try {
      const link = await createActionLink({
        action_type: "Punch Item Update",
        related_entity_id: punchItemId,
        contractor_id: contractorId as string,
        project_id: projectId,
      });
      setUrl(buildActionLinkUrl(window.location.origin, link.token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate link.");
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

  return (
    <div className="mt-1 space-y-1">
      {url ? (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            className="min-w-0 flex-1 truncate rounded border border-ink-200 bg-ink-50 px-2 py-1 text-xs text-ink-700"
          />
          <button
            type="button"
            onClick={copy}
            className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          loading={generating}
          onClick={generate}
        >
          Send update link
        </Button>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
