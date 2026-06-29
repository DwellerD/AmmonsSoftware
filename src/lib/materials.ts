import type { MaterialOrder } from "./database.types";

/**
 * Material readiness summarizes how a trade phase's material orders are doing,
 * so it can be shown at a glance on lists and detail pages.
 *
 * - "none":     no (non-cancelled) orders are tracked yet
 * - "pending":  some orders are still on the way
 * - "delayed":  at least one order is delayed (most urgent — takes priority)
 * - "received": every tracked order has been received
 */
export type MaterialReadiness = "none" | "pending" | "delayed" | "received";

/** Reduces a phase's material orders to a single readiness state. */
export function materialReadiness(orders: MaterialOrder[]): MaterialReadiness {
  // Cancelled orders no longer count toward readiness.
  const relevant = orders.filter((o) => o.status !== "Cancelled");
  if (relevant.length === 0) return "none";
  if (relevant.some((o) => o.status === "Delayed")) return "delayed";
  if (relevant.every((o) => o.status === "Received")) return "received";
  return "pending";
}

export const MATERIAL_READINESS_LABELS: Record<MaterialReadiness, string> = {
  none: "No materials",
  pending: "Materials pending",
  delayed: "Materials delayed",
  received: "Materials received",
};

export const MATERIAL_READINESS_STYLES: Record<MaterialReadiness, string> = {
  none: "bg-ink-100 text-ink-600",
  pending: "bg-amber-100 text-amber-800",
  delayed: "bg-red-100 text-red-800",
  received: "bg-green-100 text-green-800",
};
