"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { MaterialReceiptPanel } from "@/components/materials/MaterialReceiptPanel";
import { EmptyState, ErrorAlert, LoadingState } from "@/components/ui/States";
import {
  listMaterialOrders,
  listProjects,
  listTrades,
  updateMaterialOrder,
  type TradeWithContractor,
  type UpdateMaterialOrderInput,
} from "@/lib/api";
import { MATERIAL_ORDER_STATUSES, MATERIAL_ORDER_STATUS_STYLES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/providers/AuthProvider";
import type {
  MaterialOrder,
  MaterialOrderStatus,
  Project,
} from "@/lib/database.types";

interface MaterialEditForm {
  name: string;
  supplier: string;
  tracking_number: string;
  cost: string;
  status: MaterialOrderStatus;
  expected_arrival_date: string;
  actual_arrival_date: string;
  notes: string;
}

/**
 * Material tracking list.
 *
 * Shows every material order with quick filters for project, status, and trade.
 * Clicking any row opens a details editor on this same screen where the GC can
 * review notes, update status, and keep an optional tracking number.
 */
export default function MaterialOrdersPage() {
  const PAGE_SIZE = 25;
  const { canManage } = useAuth();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<MaterialOrder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [trades, setTrades] = useState<TradeWithContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<"" | MaterialOrderStatus>("");
  const [tradeId, setTradeId] = useState("");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edit, setEdit] = useState<MaterialEditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [o, p, t] = await Promise.all([
          listMaterialOrders(),
          listProjects(),
          listTrades(),
        ]);
        setOrders(o);
        setProjects(p);
        setTrades(t);

        const queryStatus = searchParams.get("status");
        if (
          queryStatus &&
          MATERIAL_ORDER_STATUSES.includes(queryStatus as MaterialOrderStatus)
        ) {
          setStatus(queryStatus as MaterialOrderStatus);
        }

        const queryMaterialId = searchParams.get("materialId");
        if (queryMaterialId && o.some((order) => order.id === queryMaterialId)) {
          setSelectedId(queryMaterialId);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load material orders.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [searchParams]);

  const tradeNames = useMemo(
    () => new Map(trades.map((t) => [t.id, t.name])),
    [trades],
  );

  const tradeOptions = useMemo(
    () =>
      projectId ? trades.filter((t) => t.project_id === projectId) : trades,
    [trades, projectId],
  );

  const visibleOrders = useMemo(
    () =>
      orders.filter((o) => {
        if (projectId && o.project_id !== projectId) return false;
        if (status && o.status !== status) return false;
        if (tradeId && o.trade_id !== tradeId) return false;
        return true;
      }),
    [orders, projectId, status, tradeId],
  );

  useEffect(() => {
    setPage(1);
  }, [projectId, status, tradeId]);

  const pagedOrders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleOrders.slice(start, start + PAGE_SIZE);
  }, [page, visibleOrders]);

  const visibleTotalCost = useMemo(
    () =>
      visibleOrders.reduce(
        (sum, order) => sum + (typeof order.cost === "number" ? order.cost : 0),
        0,
      ),
    [visibleOrders],
  );

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? null,
    [orders, selectedId],
  );

  useEffect(() => {
    if (!selectedOrder) {
      setEdit(null);
      return;
    }
    setEdit({
      name: selectedOrder.name,
      supplier: selectedOrder.supplier ?? "",
      tracking_number: selectedOrder.tracking_number ?? "",
      cost: typeof selectedOrder.cost === "number" ? String(selectedOrder.cost) : "",
      status: selectedOrder.status,
      expected_arrival_date: selectedOrder.expected_arrival_date ?? "",
      actual_arrival_date: selectedOrder.actual_arrival_date ?? "",
      notes: selectedOrder.notes ?? "",
    });
    setEditError(null);
  }, [selectedOrder]);

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrder || !edit) return;
    if (!edit.name.trim()) {
      setEditError("Material name is required.");
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      const payload: UpdateMaterialOrderInput = {
        name: edit.name.trim(),
        supplier: edit.supplier.trim() || undefined,
        tracking_number: edit.tracking_number.trim() || undefined,
        cost: edit.cost.trim() ? Number(edit.cost) : undefined,
        status: edit.status,
        expected_arrival_date: edit.expected_arrival_date || undefined,
        actual_arrival_date: edit.actual_arrival_date || undefined,
        notes: edit.notes.trim() || undefined,
      };
      const saved = await updateMaterialOrder(selectedOrder.id, payload);
      setOrders((prev) => prev.map((o) => (o.id === saved.id ? saved : o)));
      setEdit({
        name: saved.name,
        supplier: saved.supplier ?? "",
        tracking_number: saved.tracking_number ?? "",
        cost: typeof saved.cost === "number" ? String(saved.cost) : "",
        status: saved.status,
        expected_arrival_date: saved.expected_arrival_date ?? "",
        actual_arrival_date: saved.actual_arrival_date ?? "",
        notes: saved.notes ?? "",
      });
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Failed to save material details.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Material tracking"
        description="Every order across your projects and where each one stands."
        action={
          canManage ? (
            <div className="flex items-center gap-2">
              <Button variant="outline">Total cost: {formatCurrency(visibleTotalCost)}</Button>
              <Link href="/material-orders/new">
                <Button>New material order</Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      {selectedOrder && edit && (
        <Card className="mb-5">
          <CardBody>
            <form onSubmit={handleSaveDetails} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-ink-900">
                  Material details
                </h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedId(null)}
                >
                  Close
                </Button>
              </div>

              {editError && <ErrorAlert message={editError} />}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Material" htmlFor="material-detail-name" required>
                  <Input
                    id="material-detail-name"
                    value={edit.name}
                    onChange={(e) =>
                      setEdit((prev) =>
                        prev ? { ...prev, name: e.target.value } : prev,
                      )
                    }
                    disabled={!canManage}
                  />
                </Field>
                <Field label="Supplier" htmlFor="material-detail-supplier">
                  <Input
                    id="material-detail-supplier"
                    value={edit.supplier}
                    onChange={(e) =>
                      setEdit((prev) =>
                        prev ? { ...prev, supplier: e.target.value } : prev,
                      )
                    }
                    disabled={!canManage}
                  />
                </Field>

                <Field label="Status" htmlFor="material-detail-status">
                  <Select
                    id="material-detail-status"
                    value={edit.status}
                    onChange={(e) =>
                      setEdit((prev) =>
                        prev
                          ? {
                              ...prev,
                              status: e.target.value as MaterialOrderStatus,
                            }
                          : prev,
                      )
                    }
                    disabled={!canManage}
                  >
                    {MATERIAL_ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Tracking number" htmlFor="material-detail-tracking">
                  <Input
                    id="material-detail-tracking"
                    className="max-w-xs"
                    value={edit.tracking_number}
                    onChange={(e) =>
                      setEdit((prev) =>
                        prev
                          ? { ...prev, tracking_number: e.target.value }
                          : prev,
                      )
                    }
                    placeholder="Optional"
                    disabled={!canManage}
                  />
                </Field>

                <Field label="Cost ($)" htmlFor="material-detail-cost">
                  <Input
                    id="material-detail-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    className="max-w-xs"
                    value={edit.cost}
                    onChange={(e) =>
                      setEdit((prev) =>
                        prev ? { ...prev, cost: e.target.value } : prev,
                      )
                    }
                    placeholder="Optional"
                    disabled={!canManage}
                  />
                </Field>

                <Field label="Expected arrival" htmlFor="material-detail-expected">
                  <Input
                    id="material-detail-expected"
                    type="date"
                    value={edit.expected_arrival_date}
                    onChange={(e) =>
                      setEdit((prev) =>
                        prev
                          ? { ...prev, expected_arrival_date: e.target.value }
                          : prev,
                      )
                    }
                    disabled={!canManage}
                  />
                </Field>

                <Field label="Actual arrival" htmlFor="material-detail-actual">
                  <Input
                    id="material-detail-actual"
                    type="date"
                    value={edit.actual_arrival_date}
                    onChange={(e) =>
                      setEdit((prev) =>
                        prev
                          ? { ...prev, actual_arrival_date: e.target.value }
                          : prev,
                      )
                    }
                    disabled={!canManage}
                  />
                </Field>
              </div>

              <Field label="Notes" htmlFor="material-detail-notes">
                <Textarea
                  id="material-detail-notes"
                  value={edit.notes}
                  onChange={(e) =>
                    setEdit((prev) =>
                      prev ? { ...prev, notes: e.target.value } : prev,
                    )
                  }
                  placeholder="Delivery notes, contact details, access instructions, etc."
                  disabled={!canManage}
                />
              </Field>

              {canManage && (
                <Button type="submit" loading={saving}>
                  Save material details
                </Button>
              )}

              <MaterialReceiptPanel
                order={selectedOrder}
                canManage={canManage}
                onStatusChange={(updated) => {
                  setOrders((prev) =>
                    prev.map((order) =>
                      order.id === updated.id ? updated : order,
                    ),
                  );
                  setEdit((prev) =>
                    prev ? { ...prev, status: updated.status } : prev,
                  );
                }}
              />
            </form>
          </CardBody>
        </Card>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
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
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | MaterialOrderStatus)}
        >
          <option value="">All statuses</option>
          {MATERIAL_ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
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
      </div>

      {loading ? (
        <LoadingState message="Loading material orders…" />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : visibleOrders.length === 0 ? (
        <EmptyState
          title={
            orders.length === 0
              ? "No material orders yet"
              : "No orders match these filters"
          }
          description={
            orders.length === 0
              ? "Create your first material order to start tracking deliveries."
              : "Try clearing a filter to see more."
          }
          action={
            orders.length === 0 && canManage ? (
              <Link href="/material-orders/new">
                <Button>New material order</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {pagedOrders.map((order) => (
                <li
                  key={order.id}
                  className="px-5 py-4"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedId(order.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900">
                          {order.name}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-500">
                          {order.supplier ?? "No supplier"}
                          {" · "}
                          {order.trade_id
                            ? (tradeNames.get(order.trade_id) ?? "Unknown trade")
                            : "No trade"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          MATERIAL_ORDER_STATUS_STYLES[order.status],
                        )}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                      <span>
                        Expected:{" "}
                        <span className="text-ink-700">
                          {order.expected_arrival_date
                            ? formatDate(order.expected_arrival_date)
                            : "—"}
                        </span>
                      </span>
                      <span>
                        Arrived:{" "}
                        <span className="text-ink-700">
                          {order.actual_arrival_date
                            ? formatDate(order.actual_arrival_date)
                            : "—"}
                        </span>
                      </span>
                      {order.tracking_number && (
                        <span>
                          Tracking:{" "}
                          <span className="font-medium text-ink-700">
                            {order.tracking_number}
                          </span>
                        </span>
                      )}
                      {typeof order.cost === "number" && (
                        <span>
                          Cost:{" "}
                          <span className="font-medium text-ink-700">
                            {formatCurrency(order.cost)}
                          </span>
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {!loading && !error && visibleOrders.length > 0 && (
        <PaginationControls
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={visibleOrders.length}
          label="material orders"
          onPageChange={setPage}
        />
      )}
    </PageContainer>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
