"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { ErrorAlert, Spinner } from "@/components/ui/States";
import {
  createMaterialOrder,
  listMaterialOrders,
  updateMaterialOrderStatus,
  updateTradePhaseStatus,
} from "@/lib/api";
import {
  MATERIAL_ORDER_STATUSES,
  MATERIAL_ORDER_STATUS_STYLES,
} from "@/lib/constants";
import {
  materialReadiness,
  MATERIAL_READINESS_LABELS,
  MATERIAL_READINESS_STYLES,
} from "@/lib/materials";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  MaterialOrder,
  MaterialOrderStatus,
  TradePhaseStatus,
} from "@/lib/database.types";

/**
 * Material orders for a trade phase: list each order with its procurement /
 * delivery status, add new ones, and update status inline. Orders created here
 * are linked to the phase, its trade, and the project.
 *
 * A readiness banner rolls the orders up into a single state and lets the GC
 * block the phase when materials are delayed, or move it to "Ready to Schedule"
 * once everything has been received.
 */
export function MaterialsSection({
  tradePhaseId,
  projectId,
  tradeId,
  phaseStatus,
  onPhaseStatusChange,
}: {
  tradePhaseId: string;
  projectId: string;
  tradeId: string;
  phaseStatus: TradePhaseStatus;
  onPhaseStatusChange?: () => void;
}) {
  const [items, setItems] = useState<MaterialOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [cost, setCost] = useState("");
  const [status, setStatus] = useState<MaterialOrderStatus>("Needed");
  const [expected, setExpected] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Phase-status action (block / ready to schedule) state.
  const [phaseAction, setPhaseAction] = useState<TradePhaseStatus | null>(null);
  const [phaseActionError, setPhaseActionError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        setItems(await listMaterialOrders({ tradePhaseId }));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load material orders.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tradePhaseId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Material name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await createMaterialOrder({
        project_id: projectId,
        trade_phase_id: tradePhaseId,
        trade_id: tradeId,
        name: name.trim(),
        supplier: supplier.trim() || undefined,
        tracking_number: trackingNumber.trim() || undefined,
        cost: cost.trim() ? Number(cost) : undefined,
        status,
        expected_arrival_date: expected || undefined,
      });
      setItems((prev) => [...prev, created]);
      setName("");
      setSupplier("");
      setTrackingNumber("");
      setCost("");
      setStatus("Needed");
      setExpected("");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to add material order.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id: string, next: MaterialOrderStatus) {
    // Optimistic update; revert on failure.
    const previous = items;
    setItems((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: next } : m)),
    );
    try {
      await updateMaterialOrderStatus(id, next);
    } catch {
      setItems(previous);
    }
  }

  // Roll the orders up into a single readiness state for the banner + actions.
  const readiness = useMemo(() => materialReadiness(items), [items]);

  // The GC can block on delays, or advance to scheduling once all received.
  const canBlock =
    readiness === "delayed" &&
    phaseStatus !== "Blocked" &&
    phaseStatus !== "Approved" &&
    phaseStatus !== "Completed";
  const canReady =
    readiness === "received" &&
    (phaseStatus === "Not Ready" ||
      phaseStatus === "Materials Pending" ||
      phaseStatus === "Blocked");

  async function changePhaseStatus(next: TradePhaseStatus) {
    setPhaseActionError(null);
    setPhaseAction(next);
    try {
      await updateTradePhaseStatus(tradePhaseId, next);
      onPhaseStatusChange?.();
    } catch (err) {
      setPhaseActionError(
        err instanceof Error ? err.message : "Failed to update phase status.",
      );
    } finally {
      setPhaseAction(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Material orders</CardTitle>
        <span className="text-xs text-ink-500">{items.length} tracked</span>
      </CardHeader>
      <CardBody className="space-y-4">
        {error && <ErrorAlert message={error} />}

        {!loading && items.length > 0 && (
          <div className="space-y-3 rounded-lg border border-ink-100 bg-ink-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  MATERIAL_READINESS_STYLES[readiness],
                )}
              >
                {MATERIAL_READINESS_LABELS[readiness]}
              </span>
              <span className="text-xs text-ink-500">
                {items.filter((m) => m.status === "Received").length}/
                {items.filter((m) => m.status !== "Cancelled").length} received
              </span>
            </div>

            {phaseActionError && <ErrorAlert message={phaseActionError} />}

            {canBlock && (
              <Button
                size="sm"
                variant="outline"
                loading={phaseAction === "Blocked"}
                onClick={() => changePhaseStatus("Blocked")}
              >
                Block phase — materials delayed
              </Button>
            )}
            {canReady && (
              <Button
                size="sm"
                loading={phaseAction === "Ready to Schedule"}
                onClick={() => changePhaseStatus("Ready to Schedule")}
              >
                Mark Ready to Schedule
              </Button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-500">No material orders yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/material-orders?materialId=${m.id}`}
                    className="truncate text-sm font-medium text-ink-800 hover:underline"
                  >
                    {m.name}
                  </Link>
                  <p className="text-xs text-ink-500">
                    {m.supplier ? `${m.supplier} · ` : ""}
                    {m.actual_arrival_date
                      ? `arrived ${formatDate(m.actual_arrival_date)}`
                      : m.expected_arrival_date
                        ? `expected ${formatDate(m.expected_arrival_date)}`
                        : "no ETA"}
                    {m.tracking_number ? ` · tracking ${m.tracking_number}` : ""}
                    {typeof m.cost === "number"
                      ? ` · $${m.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : ""}
                  </p>
                </div>
                <Select
                  aria-label={`Status for ${m.name}`}
                  className={cn(
                    "h-8 w-auto py-0 text-xs font-medium",
                    MATERIAL_ORDER_STATUS_STYLES[m.status],
                  )}
                  value={m.status}
                  onChange={(e) =>
                    handleStatusChange(
                      m.id,
                      e.target.value as MaterialOrderStatus,
                    )
                  }
                >
                  {MATERIAL_ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="space-y-3 border-t border-ink-100 pt-4">
          {formError && <ErrorAlert message={formError} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Material" htmlFor="material-name" required>
              <Input
                id="material-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 2x4 studs"
              />
            </Field>
            <Field label="Supplier" htmlFor="material-supplier">
              <Input
                id="material-supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="Tracking number" htmlFor="material-tracking">
              <Input
                id="material-tracking"
                className="max-w-xs"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="Cost ($)" htmlFor="material-cost">
              <Input
                id="material-cost"
                type="number"
                min="0"
                step="0.01"
                className="max-w-xs"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="Status" htmlFor="material-status">
              <Select
                id="material-status"
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
            <Field label="Expected arrival" htmlFor="material-expected">
              <Input
                id="material-expected"
                type="date"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
              />
            </Field>
          </div>
          <Button type="submit" size="sm" loading={saving}>
            Add material order
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
