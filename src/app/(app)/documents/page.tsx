"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState, ErrorAlert, LoadingState } from "@/components/ui/States";
import {
  listDocuments,
  listProjects,
  listTradePhases,
  listTrades,
  setDocumentPinned,
  type TradeWithContractor,
} from "@/lib/api";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_STYLES,
  PINNABLE_PLAN_TYPES,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { isImageFile } from "@/lib/documents";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/providers/AuthProvider";
import type {
  DocumentType,
  Project,
  ProjectDocument,
  TradePhaseWithRelations,
} from "@/lib/database.types";

/**
 * Document Vault — a searchable list of every uploaded project document.
 *
 * Documents are loaded from Firestore; related project / trade / phase names
 * are resolved in memory (Firestore has no joins). Dropdown filters narrow the
 * list by project, document type, trade, and pinned status. Pinned documents
 * are shown first so the hardest-to-find files surface quickly.
 */
export default function DocumentsPage() {
  const { canManage } = useAuth();

  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [trades, setTrades] = useState<TradeWithContractor[]>([]);
  const [phases, setPhases] = useState<TradePhaseWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("");
  const [documentType, setDocumentType] = useState<"" | DocumentType>("");
  const [tradeId, setTradeId] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [docs, p, t, ph] = await Promise.all([
          listDocuments(),
          listProjects(),
          listTrades(),
          listTradePhases(),
        ]);
        setDocuments(docs);
        setProjects(p);
        setTrades(t);
        setPhases(ph);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load documents.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const projectNames = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );
  const tradeNames = useMemo(
    () => new Map(trades.map((t) => [t.id, t.name])),
    [trades],
  );
  const phaseTitles = useMemo(
    () => new Map(phases.map((p) => [p.id, p.title])),
    [phases],
  );

  // Trades shown in the filter depend on the selected project.
  const tradeOptions = useMemo(
    () => (projectId ? trades.filter((t) => t.project_id === projectId) : trades),
    [trades, projectId],
  );

  // Pinned blueprints & layouts get their own quick-access section up top.
  const pinnedPlans = useMemo(
    () =>
      documents
        .filter(
          (d) =>
            d.pinned &&
            (PINNABLE_PLAN_TYPES as readonly string[]).includes(
              d.document_type,
            ) &&
            (!projectId || d.project_id === projectId),
        )
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [documents, projectId],
  );

  async function handleTogglePin(d: ProjectDocument) {
    const updated = await setDocumentPinned(d.id, !d.pinned);
    setDocuments((prev) =>
      prev.map((x) => (x.id === updated.id ? updated : x)),
    );
  }

  // Apply filters, then sort pinned-first (newest within each group).
  const visibleDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = documents.filter((d) => {
      if (projectId && d.project_id !== projectId) return false;
      if (documentType && d.document_type !== documentType) return false;
      if (tradeId && d.trade_id !== tradeId) return false;
      if (pinnedOnly && !d.pinned) return false;
      if (term) {
        const inName = d.name.toLowerCase().includes(term);
        const inTags = d.tags.some((tag) => tag.toLowerCase().includes(term));
        if (!inName && !inTags) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.created_at < b.created_at ? 1 : -1;
    });
  }, [documents, search, projectId, documentType, tradeId, pinnedOnly]);

  return (
    <PageContainer>
      <PageHeader
        title="Document Vault"
        description="Blueprints, layouts, contracts, invoices, permits, and more."
        action={
          canManage ? (
            <Link href="/documents/new">
              <Button>Upload document</Button>
            </Link>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="mb-5 space-y-3">
        <Input
          type="search"
          aria-label="Search documents by name or tag"
          placeholder="Search by name or tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            aria-label="Filter by project"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setTradeId("");
            }}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by document type"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as "" | DocumentType)}
          >
            <option value="">All types</option>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by trade"
            value={tradeId}
            onChange={(e) => setTradeId(e.target.value)}
          >
            <option value="">All trades</option>
            {tradeOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by pinned status"
            value={pinnedOnly ? "pinned" : "all"}
            onChange={(e) => setPinnedOnly(e.target.value === "pinned")}
          >
            <option value="all">All documents</option>
            <option value="pinned">Pinned only</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading documents…" />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : (
        <>
          {pinnedPlans.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold text-ink-700">
                Pinned blueprints & layouts
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pinnedPlans.map((d) => (
                  <Card key={d.id}>
                    <CardBody className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={d.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-ink-900 hover:underline"
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
                      <p className="truncate text-sm text-ink-500">
                        {projectNames.get(d.project_id) ?? "Unknown project"}
                      </p>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleTogglePin(d)}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Unpin
                        </button>
                      )}
                    </CardBody>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {visibleDocuments.length === 0 ? (
            <EmptyState
              title={
                documents.length === 0
                  ? "No documents yet"
                  : "No documents match these filters"
              }
              description={
                documents.length === 0
                  ? "Upload your first blueprint, contract, or permit to start the vault."
                  : "Try clearing a filter to see more."
              }
              action={
                documents.length === 0 && canManage ? (
                  <Link href="/documents/new">
                    <Button>Upload document</Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <Card>
              <CardBody className="p-0">
                <ul className="divide-y divide-ink-100">
                  {visibleDocuments.map((d) => (
                    <li key={d.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {d.pinned && (
                              <span
                                aria-label="Pinned"
                                title="Pinned"
                                className="text-amber-500"
                              >
                                ★
                              </span>
                            )}
                            <a
                              href={d.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate font-medium text-ink-900 hover:underline"
                            >
                              {d.name}
                            </a>
                          </div>
                          <p className="mt-0.5 truncate text-sm text-ink-500">
                            {projectNames.get(d.project_id) ?? "Unknown project"}
                            {d.trade_phase_id
                              ? ` · ${phaseTitles.get(d.trade_phase_id) ?? "Phase"}`
                              : d.trade_id
                                ? ` · ${tradeNames.get(d.trade_id) ?? "Trade"}`
                                : ""}
                          </p>
                          {d.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {d.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-600"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                              DOCUMENT_TYPE_STYLES[d.document_type],
                            )}
                          >
                            {d.document_type}
                          </span>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleTogglePin(d)}
                              className="text-xs font-medium text-brand-600 hover:underline"
                            >
                              {d.pinned ? "Unpin" : "Pin"}
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-ink-400">
                        {isImageFile(d.file_url) ? "Image" : "File"} · uploaded{" "}
                        {formatDate(d.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </PageContainer>
  );
}
