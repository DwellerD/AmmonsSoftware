"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  ErrorAlert,
  LoadingState,
  SuccessAlert,
} from "@/components/ui/States";
import {
  createDocument,
  listContractors,
  listProjects,
  listTradePhases,
  listTrades,
  uploadProjectDocumentFile,
  type TradeWithContractor,
} from "@/lib/api";
import { DOCUMENT_TYPES } from "@/lib/constants";
import {
  MAX_DOCUMENT_BYTES,
  formatBytes,
  inferDocumentType,
  parseTags,
} from "@/lib/documents";
import type {
  Contractor,
  DocumentType,
  Project,
  ProjectDocument,
  TradePhaseWithRelations,
} from "@/lib/database.types";

/**
 * Document upload form for the GC / internal team.
 *
 * Picks a file, fills in metadata (name, type, project + optional trade / phase
 * / contractor, tags, pinned), uploads the file to Firebase Storage with a live
 * progress bar, then saves the metadata to Firestore.
 *
 * The form can be used standalone (e.g. on /documents/new) or embedded with
 * presets (e.g. on a trade phase detail page) by passing the `preset*` props
 * and `lock*` flags to hide/lock the relevant selectors.
 */
export function DocumentUploadForm({
  presetProjectId,
  presetTradeId,
  presetTradePhaseId,
  presetContractorId,
  presetPunchItemId,
  lockProject = false,
  lockTradePhase = false,
  onUploaded,
  onCancel,
}: {
  presetProjectId?: string;
  presetTradeId?: string;
  presetTradePhaseId?: string;
  presetContractorId?: string;
  presetPunchItemId?: string;
  lockProject?: boolean;
  lockTradePhase?: boolean;
  onUploaded?: (doc: ProjectDocument) => void;
  onCancel?: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [trades, setTrades] = useState<TradeWithContractor[]>([]);
  const [phases, setPhases] = useState<TradePhaseWithRelations[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("Other");
  const [projectId, setProjectId] = useState(presetProjectId ?? "");
  const [tradeId, setTradeId] = useState(presetTradeId ?? "");
  const [tradePhaseId, setTradePhaseId] = useState(presetTradePhaseId ?? "");
  const [contractorId, setContractorId] = useState(presetContractorId ?? "");
  const [tagsInput, setTagsInput] = useState("");
  const [pinned, setPinned] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load the option lists once.
  useEffect(() => {
    async function load() {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        const [p, t, ph, c] = await Promise.all([
          listProjects(),
          listTrades(),
          listTradePhases(),
          listContractors(),
        ]);
        setProjects(p);
        setTrades(t);
        setPhases(ph);
        setContractors(c);
        setProjectId((prev) => prev || presetProjectId || p[0]?.id || "");
      } catch (err) {
        setOptionsError(
          err instanceof Error ? err.message : "Failed to load form data.",
        );
      } finally {
        setLoadingOptions(false);
      }
    }
    load();
  }, [presetProjectId]);

  // Trades/phases shown depend on the chosen project.
  const projectTrades = useMemo(
    () => trades.filter((t) => t.project_id === projectId),
    [trades, projectId],
  );
  const projectPhases = useMemo(
    () => phases.filter((p) => p.project_id === projectId),
    [phases, projectId],
  );

  function handleProjectChange(next: string) {
    setProjectId(next);
    // Clear trade/phase that no longer belong to the new project.
    setTradeId((prev) =>
      trades.some((t) => t.id === prev && t.project_id === next) ? prev : "",
    );
    setTradePhaseId((prev) =>
      phases.some((p) => p.id === prev && p.project_id === next) ? prev : "",
    );
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setError(null);
    if (!picked) {
      setFile(null);
      return;
    }
    if (picked.size > MAX_DOCUMENT_BYTES) {
      setFile(null);
      setError(
        `File is too large (${formatBytes(picked.size)}). Max is ${formatBytes(
          MAX_DOCUMENT_BYTES,
        )}.`,
      );
      return;
    }
    setFile(picked);
    // Prefill the name (without extension) and guess the type if not set yet.
    if (!name.trim()) {
      setName(picked.name.replace(/\.[^.]+$/, ""));
    }
    setDocumentType(inferDocumentType(picked));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (!name.trim()) {
      setError("Enter a document name.");
      return;
    }
    if (!projectId) {
      setError("Choose a project.");
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const { file_url, storage_path } = await uploadProjectDocumentFile(
        projectId,
        file,
        setProgress,
      );
      const doc = await createDocument({
        name: name.trim(),
        document_type: documentType,
        project_id: projectId,
        trade_id: tradeId || null,
        trade_phase_id: tradePhaseId || null,
        contractor_id: contractorId || null,
        punch_item_id: presetPunchItemId || null,
        file_url,
        storage_path,
        tags: parseTags(tagsInput),
        pinned,
      });
      setSuccess(`Uploaded "${doc.name}".`);
      // Reset the form for the next upload.
      setFile(null);
      setName("");
      setTagsInput("");
      setPinned(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploaded?.(doc);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload the document.",
      );
    } finally {
      setUploading(false);
    }
  }

  if (loadingOptions) {
    return <LoadingState message="Loading form…" />;
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {optionsError && <ErrorAlert message={optionsError} />}
          {error && <ErrorAlert message={error} />}
          {success && <SuccessAlert message={success} />}

          <Field label="File" htmlFor="doc-file" required>
            <input
              id="doc-file"
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelected}
              className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
            />
            {file && (
              <p className="mt-1 text-xs text-ink-500">
                {file.name} · {formatBytes(file.size)}
              </p>
            )}
          </Field>

          {uploading && (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full bg-brand-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink-500">Uploading… {progress}%</p>
            </div>
          )}

          <Field label="Document name" htmlFor="doc-name" required>
            <Input
              id="doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Building A foundation plan"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Document type" htmlFor="doc-type" required>
              <Select
                id="doc-type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>

            {!lockProject && (
              <Field label="Project" htmlFor="doc-project" required>
                <Select
                  id="doc-project"
                  value={projectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                >
                  <option value="">Select a project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {!lockTradePhase && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Related trade (optional)" htmlFor="doc-trade">
                <Select
                  id="doc-trade"
                  value={tradeId}
                  onChange={(e) => setTradeId(e.target.value)}
                >
                  <option value="">None</option>
                  {projectTrades.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Related trade phase (optional)" htmlFor="doc-phase">
                <Select
                  id="doc-phase"
                  value={tradePhaseId}
                  onChange={(e) => setTradePhaseId(e.target.value)}
                >
                  <option value="">None</option>
                  {projectPhases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {!presetContractorId && (
            <Field label="Related contractor (optional)" htmlFor="doc-contractor">
              <Select
                id="doc-contractor"
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value)}
              >
                <option value="">None</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Tags (optional)" htmlFor="doc-tags">
            <Input
              id="doc-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="comma, separated, tags"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Pin this document (surface it near the top of the vault)
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" loading={uploading}>
              Upload document
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
