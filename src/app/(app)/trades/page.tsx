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
  deleteTrade,
  listContractors,
  listProjects,
  listTrades,
  updateTrade,
  type NewTradeInput,
  type TradeWithContractor,
  type UpdateTradeInput,
} from "@/lib/api";
import { COMMON_TRADES } from "@/lib/constants";
import type { Contractor, Project } from "@/lib/database.types";

interface TradeFormValues {
  project_id: string;
  name: string;
  description: string;
  default_contractor_id: string;
}

/**
 * Trades screen: view, create, edit, duplicate, and delete trade records.
 */
export default function TradesPage() {
  const { canManage } = useAuth();
  const [trades, setTrades] = useState<TradeWithContractor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [busyTradeId, setBusyTradeId] = useState<string | null>(null);

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
  const editingTrade =
    editingTradeId != null
      ? trades.find((t) => t.id === editingTradeId) ?? null
      : null;

  async function handleDuplicate(trade: TradeWithContractor) {
    setBusyTradeId(trade.id);
    setError(null);
    try {
      const payload: NewTradeInput = {
        project_id: trade.project_id,
        name: `${trade.name} (Copy)`,
        description: trade.description ?? undefined,
        default_contractor_id: trade.default_contractor_id ?? undefined,
      };
      await createTrade(payload);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate trade.");
    } finally {
      setBusyTradeId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Trades"
        description="Trade disciplines like framing, plumbing, and electrical."
        action={
          canCreate && !showCreateForm ? (
            <Button
              onClick={() => {
                setShowCreateForm(true);
                setEditingTradeId(null);
              }}
            >
              New trade
            </Button>
          ) : undefined
        }
      />

      {showCreateForm && (
        <TradeForm
          mode="create"
          projects={projects}
          contractors={contractors}
          onCancel={() => setShowCreateForm(false)}
          onSubmit={async (values) => {
            const payload: NewTradeInput = {
              project_id: values.project_id,
              name: values.name,
              description: values.description || undefined,
              default_contractor_id: values.default_contractor_id || undefined,
            };
            await createTrade(payload);
            setShowCreateForm(false);
            await load();
          }}
        />
      )}

      {editingTrade && (
        <TradeForm
          mode="edit"
          projects={projects}
          contractors={contractors}
          initialValues={{
            project_id: editingTrade.project_id,
            name: editingTrade.name,
            description: editingTrade.description ?? "",
            default_contractor_id: editingTrade.default_contractor_id ?? "",
          }}
          onCancel={() => setEditingTradeId(null)}
          onSubmit={async (values) => {
            const payload: UpdateTradeInput = {
              project_id: values.project_id,
              name: values.name,
              description: values.description || undefined,
              default_contractor_id: values.default_contractor_id || undefined,
            };
            await updateTrade(editingTrade.id, payload);
            setEditingTradeId(null);
            await load();
          }}
          onDelete={async () => {
            const confirmed = window.confirm(
              `Delete trade "${editingTrade.name}"? This cannot be undone.`,
            );
            if (!confirmed) return;

            setBusyTradeId(editingTrade.id);
            setError(null);
            try {
              await deleteTrade(editingTrade.id);
              setEditingTradeId(null);
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to delete trade.");
            } finally {
              setBusyTradeId(null);
            }
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
              <Button
                onClick={() => {
                  setShowCreateForm(true);
                  setEditingTradeId(null);
                }}
              >
                New trade
              </Button>
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
                  <p className="mt-3 text-sm text-ink-600">{trade.description}</p>
                )}
                <p className="mt-3 text-xs text-ink-500">
                  Default contractor:{" "}
                  <span className="font-medium text-ink-700">
                    {trade.default_contractor?.company_name ?? "None"}
                  </span>
                </p>

                {canManage && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingTradeId(trade.id);
                        setShowCreateForm(false);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busyTradeId === trade.id}
                      onClick={() => handleDuplicate(trade)}
                    >
                      Duplicate
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

/** Reusable create/edit form for trade records. */
function TradeForm({
  mode,
  projects,
  contractors,
  initialValues,
  onCancel,
  onSubmit,
  onDelete,
}: {
  mode: "create" | "edit";
  projects: Project[];
  contractors: Contractor[];
  initialValues?: TradeFormValues;
  onCancel: () => void;
  onSubmit: (values: TradeFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [form, setForm] = useState<TradeFormValues>(
    initialValues ?? {
      project_id: projects[0]?.id ?? "",
      name: "",
      description: "",
      default_contractor_id: "",
    },
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof TradeFormValues>(
    key: K,
    value: TradeFormValues[K],
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
      await onSubmit({ ...form, name: form.name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save trade.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete trade.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}

          <Field label="Project" htmlFor={`${mode}-trade-project`} required>
            <Select
              id={`${mode}-trade-project`}
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

          <Field label="Trade name" htmlFor={`${mode}-trade-name`} required>
            <Input
              id={`${mode}-trade-name`}
              list="common-trades"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Framing"
            />
            <datalist id="common-trades">
              {COMMON_TRADES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>

          <Field label="Description" htmlFor={`${mode}-trade-description`}>
            <Textarea
              id={`${mode}-trade-description`}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Scope or notes for this trade."
            />
          </Field>

          <Field
            label="Default contractor"
            htmlFor={`${mode}-trade-default-contractor`}
          >
            <Select
              id={`${mode}-trade-default-contractor`}
              value={form.default_contractor_id}
              onChange={(e) => update("default_contractor_id", e.target.value)}
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
              {mode === "create" ? "Save trade" : "Save changes"}
            </Button>
            {mode === "edit" && onDelete && (
              <Button
                type="button"
                variant="danger"
                loading={deleting}
                onClick={handleDelete}
              >
                Delete trade
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
