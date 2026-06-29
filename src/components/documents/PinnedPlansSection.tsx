"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/States";
import { listDocuments } from "@/lib/api";
import { DOCUMENT_TYPE_STYLES, PINNABLE_PLAN_TYPES } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { ProjectDocument } from "@/lib/database.types";

/**
 * Shows the pinned blueprints and layouts for a single project. Rendered on the
 * project detail page so the GC can jump straight to the key plans. Hidden when
 * the project has no pinned plans.
 */
export function PinnedPlansSection({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const all = await listDocuments({ projectId, pinnedOnly: true });
        if (!active) return;
        setDocs(
          all.filter((d) =>
            (PINNABLE_PLAN_TYPES as readonly string[]).includes(
              d.document_type,
            ),
          ),
        );
      } catch {
        if (active) setDocs([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [projectId]);

  if (loading) {
    return <LoadingState message="Loading pinned plans…" />;
  }
  if (docs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pinned blueprints & layouts</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2">
        {docs.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2"
          >
            <a
              href={d.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-medium text-ink-900 hover:underline"
            >
              ★ {d.name}
            </a>
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                DOCUMENT_TYPE_STYLES[d.document_type],
              )}
            >
              {d.document_type}
            </span>
          </div>
        ))}
        <Link
          href="/documents"
          className="inline-block pt-1 text-sm font-medium text-brand-600 hover:underline"
        >
          View all documents →
        </Link>
      </CardBody>
    </Card>
  );
}
