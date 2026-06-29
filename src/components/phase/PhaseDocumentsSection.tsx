"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ErrorAlert, LoadingState } from "@/components/ui/States";
import { DocumentUploadForm } from "@/components/forms/DocumentUploadForm";
import { listDocuments } from "@/lib/api";
import { DOCUMENT_TYPE_STYLES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/providers/AuthProvider";
import type { ProjectDocument } from "@/lib/database.types";

/**
 * Documents attached to a single trade phase. Lists the phase's documents and
 * lets the GC / internal team upload a new file that is automatically linked to
 * this phase (project + trade + phase pre-filled and locked).
 */
export function PhaseDocumentsSection({
  tradePhaseId,
  projectId,
  tradeId,
}: {
  tradePhaseId: string;
  projectId: string;
  tradeId: string;
}) {
  const { canManage } = useAuth();
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listDocuments({ tradePhaseId });
      setDocs(list);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load documents.",
      );
    } finally {
      setLoading(false);
    }
  }, [tradePhaseId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Documents</CardTitle>
        {canManage && (
          <Button size="sm" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Close" : "Upload document"}
          </Button>
        )}
      </CardHeader>
      <CardBody className="space-y-4">
        {showForm && canManage && (
          <DocumentUploadForm
            presetProjectId={projectId}
            presetTradeId={tradeId}
            presetTradePhaseId={tradePhaseId}
            lockProject
            lockTradePhase
            onUploaded={() => {
              setShowForm(false);
              load();
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {loading ? (
          <LoadingState message="Loading documents…" />
        ) : error ? (
          <ErrorAlert message={error} />
        ) : docs.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-500">
            No documents attached to this phase yet.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <a
                    href={d.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate font-medium text-ink-900 hover:underline"
                  >
                    {d.pinned ? "★ " : ""}
                    {d.name}
                  </a>
                  <p className="text-xs text-ink-400">
                    uploaded {formatDate(d.created_at)}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    DOCUMENT_TYPE_STYLES[d.document_type],
                  )}
                >
                  {d.document_type}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
