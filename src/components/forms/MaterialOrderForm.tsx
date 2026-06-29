"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import {
  ErrorAlert,
  LoadingState,
  SuccessAlert,
} from "@/components/ui/States";
import {
  createMaterialOrder,
  listProjects,
  listTradePhases,
  type NewMaterialOrderInput,
} from "@/lib/api";
import { MATERIAL_ORDER_STATUSES } from "@/lib/constants";
import type {
  MaterialOrderStatus,
  Project,
  TradePhaseWithRelations,
} from "@/lib/database.types";

/**
 * Standalone material order creation form.
 *
 * The GC picks a project (required), optionally ties the order to a trade
 * phase within that project, and records the material name, supplier, expected
 * arrival date, status, and notes. Saves to Firestore via createMaterialOrder.
 *
 * Loads the option lists up front, filters trade phases to the chosen project,
 * validates required fields, and surfaces loading / error / success states.
 */
export function MaterialOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") ?? "";
  const initialPhaseId = searchParams.get("tradePhaseId") ?? "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [phases, setPhases] = useState<TradePhaseWithRelations[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState(initialProjectId);
  const [tradePhaseId, setTradePhaseId] = useState(initialPhaseId);
  const [name, setName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [expected, setExpected] = useState("");
  const [status, setStatus] = useState<MaterialOrderStatus>("Needed");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load projects and trade phases once.
  useEffect(() => {
    async function load() {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        const [p, ph] = await Promise.all([listProjects(), listTradePhases()]);
        setProjects(p);
        setPhases(ph);
        setProjectId((prev) => prev || p[0]?.id || "");
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

  // Only offer trade phases that belong to the selected project.
  const projectPhases = useMemo(
    () => phases.filter((p) => p.project_id === projectId),
    [phases, projectId],
  );

  // When the project changes, clear a phase that no longer belongs to it.
  function handleProjectChange(next: string) {
    setProjectId(next);
    setTradePhaseId((prev) =>
      phases.some((p) => p.id === prev && p.project_id === next) ? prev : "",
    );
  }

  function resetForm() {
    setName("");
    setSupplier("");
    setExpected("");
    setStatus("Needed");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(null);

    if (!projectId) return setError("Please choose a project.");
    if (!name.trim()) return setError("Material name is required.");

    setSaving(true);
    setError(null);
    try {
      const input: NewMaterialOrderInput = {
        project_id: projectId,
        trade_phase_id: tradePhaseId || undefined,
        name: name.trim(),
        supplier: supplier.trim() || undefined,
        expected_arrival_date: expected || undefined,
        status,
        notes: notes.trim() || undefined,
      };
      const order = await createMaterialOrder(input);
      setSuccess(`Material order "${order.name}" was created.`);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save material order.",
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
            You need at least one project before creating a material order.
            Create a project first.
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
          {success && <SuccessAlert message={success} />}

          <Field label="Project" htmlFor="project_id" required>
            <Select
              id="project_id"
              value={projectId}
              onChange={(e) => handleProjectChange(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Trade phase" htmlFor="trade_phase_id">
            <Select
              id="trade_phase_id"
              value={tradePhaseId}
              onChange={(e) => setTradePhaseId(e.target.value)}
            >
              <option value="">Not tied to a phase</option>
              {projectPhases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
            {projectPhases.length === 0 && (
              <p className="mt-1 text-sm text-ink-500">
                This project has no trade phases yet — that&apos;s fine, the
                order can stand on its own.
              </p>
            )}
          </Field>

          <Field label="Material" htmlFor="name" required>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2x4 studs"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier" htmlFor="supplier">
              <Input
                id="supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="Expected arrival" htmlFor="expected">
              <Input
                id="expected"
                type="date"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Status" htmlFor="status" required>
            <Select
              id="status"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as MaterialOrderStatus)
              }
            >
              {MATERIAL_ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Order number, delivery instructions, anything worth tracking."
            />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              Create material order
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
