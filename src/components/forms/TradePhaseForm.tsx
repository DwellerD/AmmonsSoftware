"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import {
  ErrorAlert,
  LoadingState,
} from "@/components/ui/States";
import {
  createTradePhase,
  listContractors,
  listProjects,
  listTrades,
  type NewTradePhaseInput,
  type TradeWithContractor,
} from "@/lib/api";
import { TRADE_PHASE_STATUSES } from "@/lib/constants";
import type {
  Contractor,
  Project,
  TradePhaseStatus,
} from "@/lib/database.types";

/**
 * The Trade Phase creation form.
 *
 * A trade phase is the core unit of work the GC tracks. The form ties together
 * a project, a trade, an optional contractor, scheduling dates, and a status.
 *
 * It loads the option lists (projects, trades, contractors) up front, filters
 * the trade list to the chosen project, validates required fields, and saves
 * to Firestore.
 */
export function TradePhaseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") ?? "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [trades, setTrades] = useState<TradeWithContractor[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [form, setForm] = useState<NewTradePhaseInput>({
    project_id: initialProjectId,
    trade_id: "",
    title: "",
    status: "Not Ready",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the option lists once.
  useEffect(() => {
    async function load() {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        const [p, t, c] = await Promise.all([
          listProjects(),
          listTrades(),
          listContractors(),
        ]);
        setProjects(p);
        setTrades(t);
        setContractors(c);
        // Default to the first project if none was preselected.
        setForm((prev) => ({
          ...prev,
          project_id: prev.project_id || p[0]?.id || "",
        }));
      } catch (err) {
        setOptionsError(
          err instanceof Error ? err.message : "Failed to load form data.",
        );
      } finally {
        setLoadingOptions(false);
      }
    }
    load();
  }, []);

  // Only show trades that belong to the selected project.
  const projectTrades = useMemo(
    () => trades.filter((t) => t.project_id === form.project_id),
    [trades, form.project_id],
  );

  function update<K extends keyof NewTradePhaseInput>(
    key: K,
    value: NewTradePhaseInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // When the project changes, reset the trade choice (trades are project-scoped).
  function handleProjectChange(projectId: string) {
    setForm((prev) => ({ ...prev, project_id: projectId, trade_id: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.project_id) return setError("Please choose a project.");
    if (!form.trade_id) return setError("Please choose a trade.");
    if (!form.title.trim()) return setError("Title is required.");

    setSaving(true);
    setError(null);
    try {
      const phase = await createTradePhase(form);
      router.push(`/trade-phases/${phase.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save trade phase.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingOptions) return <LoadingState message="Loading form…" />;
  if (optionsError) return <ErrorAlert message={optionsError} />;

  if (projects.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-ink-600">
            You need at least one project and trade before creating a trade
            phase. Create a project and a trade first.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}

          <Field label="Project" htmlFor="project_id" required>
            <Select
              id="project_id"
              value={form.project_id}
              onChange={(e) => handleProjectChange(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Trade" htmlFor="trade_id" required>
            <Select
              id="trade_id"
              value={form.trade_id}
              onChange={(e) => update("trade_id", e.target.value)}
            >
              <option value="">Select a trade…</option>
              {projectTrades.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            {projectTrades.length === 0 && (
              <p className="mt-1 text-sm text-amber-700">
                This project has no trades yet. Add a trade first.
              </p>
            )}
          </Field>

          <Field label="Title" htmlFor="title" required>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Building A — 2nd floor framing"
            />
          </Field>

          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              value={form.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Scope, location, or anything the crew needs to know."
            />
          </Field>

          <Field label="Assigned contractor" htmlFor="contractor_id">
            <Select
              id="contractor_id"
              value={form.contractor_id ?? ""}
              onChange={(e) => update("contractor_id", e.target.value)}
            >
              <option value="">Unassigned</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Scheduled start" htmlFor="scheduled_start_date">
              <Input
                id="scheduled_start_date"
                type="date"
                value={form.scheduled_start_date ?? ""}
                onChange={(e) =>
                  update("scheduled_start_date", e.target.value)
                }
              />
            </Field>
            <Field label="Scheduled end" htmlFor="scheduled_end_date">
              <Input
                id="scheduled_end_date"
                type="date"
                value={form.scheduled_end_date ?? ""}
                onChange={(e) => update("scheduled_end_date", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Status" htmlFor="status" required>
            <Select
              id="status"
              value={form.status}
              onChange={(e) =>
                update("status", e.target.value as TradePhaseStatus)
              }
            >
              {TRADE_PHASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              Create trade phase
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/trade-phases")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
