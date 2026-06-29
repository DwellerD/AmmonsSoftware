"use client";

import { useEffect, useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import {
  EmptyState,
  ErrorAlert,
  LoadingState,
} from "@/components/ui/States";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  createTrade,
  listContractors,
  listProjects,
  listTrades,
  type NewTradeInput,
  type TradeWithContractor,
} from "@/lib/api";
import { COMMON_TRADES } from "@/lib/constants";
import type { Contractor, Project } from "@/lib/database.types";

/**
 * Trades screen: view trades and create new ones for a project.
 * A trade has a name, description, and an optional default contractor.
 */
export default function TradesPage() {
  const { canManage } = useAuth();
  const [trades, setTrades] = useState<TradeWithContractor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const projectName = useMemo(() => {
    const map = new Map(projects.map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? "Unknown project";
  }, [projects]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [t, p, c] = await Promise.all([
        listTrades(),
        listProjects(),
        listContractors(),
      ]);
      setTrades(t);
      setProjects(p);
      setContractors(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trades.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const canCreate = canManage && projects.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title="Trades"
        description="Trade disciplines like framing, plumbing, and electrical."
        action={
          canCreate && !showForm ? (
            <Button onClick={() => setShowForm(true)}>New trade</Button>
          ) : undefined
        }
      />

      {showForm && (
        <TradeForm
          projects={projects}
          contractors={contractors}
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {loading ? (
        <LoadingState message="Loading trades…" />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : projects.length === 0 ? (
        <EmptyState
          title="Create a project first"
          description="Trades belong to a project, so add a project before creating trades."
        />
      ) : trades.length === 0 ? (
        <EmptyState
          title="No trades yet"
          description="Add the trades involved in your project."
          action={
            canManage ? (
              <Button onClick={() => setShowForm(true)}>New trade</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trades.map((trade) => (
            <Card key={trade.id} className="h-full">
              <CardBody>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-ink-900">{trade.name}</h3>
                </div>
                <Badge className="mt-2">{projectName(trade.project_id)}</Badge>
                {trade.description && (
                  <p className="mt-3 text-sm text-ink-600">
                    {trade.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-ink-500">
                  Default contractor:{" "}
                  <span className="font-medium text-ink-700">
                    {trade.default_contractor?.company_name ?? "None"}
                  </span>
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

/** Inline form for creating a trade. */
function TradeForm({
  projects,
  contractors,
  onCancel,
  onCreated,
}: {
  projects: Project[];
  contractors: Contractor[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<NewTradeInput>({
    project_id: projects[0]?.id ?? "",
    name: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof NewTradeInput>(
    key: K,
    value: NewTradeInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.project_id) {
      setError("Please choose a project.");
      return;
    }
    if (!form.name.trim()) {
      setError("Trade name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createTrade(form);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save trade.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}

          <Field label="Project" htmlFor="project_id" required>
            <Select
              id="project_id"
              value={form.project_id}
              onChange={(e) => update("project_id", e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Trade name" htmlFor="name" required>
            <Input
              id="name"
              list="common-trades"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Framing"
            />
            {/* Quick-pick suggestions for common trades */}
            <datalist id="common-trades">
              {COMMON_TRADES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>

          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              value={form.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Scope or notes for this trade."
            />
          </Field>

          <Field label="Default contractor" htmlFor="default_contractor_id">
            <Select
              id="default_contractor_id"
              value={form.default_contractor_id ?? ""}
              onChange={(e) =>
                update("default_contractor_id", e.target.value)
              }
            >
              <option value="">None</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              Save trade
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
