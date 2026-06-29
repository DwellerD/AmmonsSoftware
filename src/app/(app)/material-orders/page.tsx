"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { EmptyState, ErrorAlert, LoadingState } from "@/components/ui/States";
import {
  listMaterialOrders,
  listProjects,
  listTrades,
  type TradeWithContractor,
} from "@/lib/api";
import { MATERIAL_ORDER_STATUSES, MATERIAL_ORDER_STATUS_STYLES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  MaterialOrder,
  MaterialOrderStatus,
  Project,
} from "@/lib/database.types";

/**
 * Material tracking list.
 *
 * Shows every material order with quick filters for project, status, and trade.
 * Orders are loaded from Firestore; the related trade name is resolved in memory
 * from the trades list. Delayed orders get an amber accent and Received orders a
 * green accent so their state reads at a glance. Filtering is in-memory so it
 * feels instant.
 */
export default function MaterialOrdersPage() {
  const [orders, setOrders] = useState<MaterialOrder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [trades, setTrades] = useState<TradeWithContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<"" | MaterialOrderStatus>("");
  const [tradeId, setTradeId] = useState("");

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
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load material orders.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Resolve trade names without an extra query.
  const tradeNames = useMemo(
    () => new Map(trades.map((t) => [t.id, t.name])),
    [trades],
  );

  // Trades shown in the filter depend on the selected project.
  const tradeOptions = useMemo(
    () =>
      projectId ? trades.filter((t) => t.project_id === projectId) : trades,
    [trades, projectId],
  );

  // Apply the active filters in memory.
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

  return (
    <PageContainer>
      <PageHeader
        title="Material tracking"
        description="Every order across your projects and where each one stands."
        action={
          <Link href="/material-orders/new">
            <Button>New material order</Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Select
          aria-label="Filter by project"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setTradeId(""); // reset trade filter when project changes
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
            orders.length === 0 ? (
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
              {visibleOrders.map((order) => (
                <li
                  key={order.id}
                  className={cn(
                    "border-l-4 px-5 py-4",
                    order.status === "Delayed"
                      ? "border-amber-400 bg-amber-50"
                      : order.status === "Received"
                        ? "border-green-400 bg-green-50/60"
                        : "border-transparent",
                  )}
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
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </PageContainer>
  );
}
