import type {
  ActionLinkStatus,
  ActionLinkType,
  CompletionStatus,
  DocumentType,
  InspectionResult,
  MaterialOrderStatus,
  NotificationType,
  PunchItemStatus,
  PunchPriority,
  TradePhaseStatus,
  UserRole,
} from "./database.types";

/**
 * Shared constants for TradeFlow.
 * Keeping these in one place makes the app easy to reason about and avoids
 * "magic strings" scattered through the codebase.
 */

/** All user roles, with friendly labels for display. */
export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "gc_site_super", label: "GC / Site Super" },
  { value: "internal_team", label: "Internal Team" },
  { value: "contractor", label: "Contractor" },
];

/** The default role new users receive when they first sign up. */
export const DEFAULT_ROLE: UserRole = "gc_site_super";

/**
 * Roles that are allowed full management access in Sprint 1.
 * Contractors are intentionally excluded from admin-style actions.
 */
export const MANAGER_ROLES: UserRole[] = [
  "admin",
  "gc_site_super",
  "internal_team",
];

/** Returns true if a role can manage projects, trades, contractors, phases. */
export function canManage(role: UserRole | null | undefined): boolean {
  return role != null && MANAGER_ROLES.includes(role);
}

/** Ordered list of trade phase statuses (matches the workflow lifecycle). */
export const TRADE_PHASE_STATUSES: TradePhaseStatus[] = [
  "Not Ready",
  "Materials Pending",
  "Ready to Schedule",
  "Scheduled",
  "In Progress",
  "Submitted Complete",
  "Needs Inspection",
  "Approved",
  "Blocked",
];

/**
 * Tailwind color classes for each status badge.
 * Centralizing this keeps status colors consistent across every screen.
 */
export const STATUS_STYLES: Record<TradePhaseStatus, string> = {
  "Not Ready": "bg-ink-100 text-ink-700",
  "Materials Pending": "bg-amber-100 text-amber-800",
  "Ready to Schedule": "bg-sky-100 text-sky-800",
  Scheduled: "bg-indigo-100 text-indigo-800",
  "In Progress": "bg-blue-100 text-blue-800",
  "Submitted Complete": "bg-violet-100 text-violet-800",
  "Needs Inspection": "bg-orange-100 text-orange-800",
  Approved: "bg-green-100 text-green-800",
  Blocked: "bg-red-100 text-red-800",
};

/** Statuses considered "active" (work that is not yet approved). */
export const ACTIVE_STATUSES: TradePhaseStatus[] = TRADE_PHASE_STATUSES.filter(
  (s) => s !== "Approved",
);

/** Example trade names, used as quick-pick suggestions in the UI. */
export const COMMON_TRADES = [
  "Framing",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Drywall",
  "Paint",
  "Flooring",
  "Finish Work",
];

/* ---------------------------------------------------------------------------
 * Sprint 2 status vocabularies + badge colors.
 * ------------------------------------------------------------------------- */

/** Ordered material-order lifecycle. */
export const MATERIAL_ORDER_STATUSES: MaterialOrderStatus[] = [
  "Needed",
  "Ordered",
  "Arriving",
  "Received",
  "Delayed",
  "Cancelled",
];

export const MATERIAL_ORDER_STATUS_STYLES: Record<MaterialOrderStatus, string> = {
  Needed: "bg-ink-100 text-ink-700",
  Ordered: "bg-sky-100 text-sky-800",
  Arriving: "bg-indigo-100 text-indigo-800",
  Received: "bg-green-100 text-green-800",
  Delayed: "bg-amber-100 text-amber-800",
  Cancelled: "bg-ink-200 text-ink-500",
};

/** Possible inspection outcomes. */
export const INSPECTION_RESULTS: InspectionResult[] = [
  "Passed",
  "Failed",
  "Needs Rework",
];

export const INSPECTION_RESULT_STYLES: Record<InspectionResult, string> = {
  Passed: "bg-green-100 text-green-800",
  Failed: "bg-red-100 text-red-800",
  "Needs Rework": "bg-amber-100 text-amber-800",
};

/** Completion-submission lifecycle. */
export const COMPLETION_STATUSES: CompletionStatus[] = [
  "Submitted",
  "Approved",
  "Rejected",
  "Needs Fix",
];

export const COMPLETION_STATUS_STYLES: Record<CompletionStatus, string> = {
  Submitted: "bg-violet-100 text-violet-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  "Needs Fix": "bg-amber-100 text-amber-800",
};

/** Punch-item lifecycle. */
export const PUNCH_ITEM_STATUSES: PunchItemStatus[] = [
  "Open",
  "In Progress",
  "Resolved",
  "Closed",
];

export const PUNCH_ITEM_STATUS_STYLES: Record<PunchItemStatus, string> = {
  Open: "bg-red-100 text-red-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Resolved: "bg-green-100 text-green-800",
  Closed: "bg-ink-200 text-ink-600",
};

/** Punch-item priority levels, ordered low → critical. */
export const PUNCH_PRIORITIES: PunchPriority[] = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

export const PUNCH_PRIORITY_STYLES: Record<PunchPriority, string> = {
  Low: "bg-ink-100 text-ink-700",
  Medium: "bg-sky-100 text-sky-800",
  High: "bg-amber-100 text-amber-800",
  Critical: "bg-red-100 text-red-800",
};

/** Friendly labels for each notification type. */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  completion_submitted: "Completion submitted",
  punch_item_assigned: "Punch item assigned",
  material_delayed: "Material delayed",
  schedule_confirmation_requested: "Schedule confirmation requested",
  schedule_confirmation_declined: "Schedule declined",
  completion_approved: "Completion approved",
  completion_rejected: "Completion rejected",
};

export const NOTIFICATION_TYPE_STYLES: Record<NotificationType, string> = {
  completion_submitted: "bg-violet-100 text-violet-800",
  punch_item_assigned: "bg-sky-100 text-sky-800",
  material_delayed: "bg-amber-100 text-amber-800",
  schedule_confirmation_requested: "bg-blue-100 text-blue-800",
  schedule_confirmation_declined: "bg-rose-100 text-rose-800",
  completion_approved: "bg-emerald-100 text-emerald-800",
  completion_rejected: "bg-orange-100 text-orange-800",
};

/* ---------------------------------------------------------------------------
 * Sprint 3: Document Vault.
 * ------------------------------------------------------------------------- */

/** All document types, in the order shown in dropdowns. */
export const DOCUMENT_TYPES: DocumentType[] = [
  "Blueprint",
  "Layout",
  "Contract",
  "Invoice",
  "Change Order",
  "Permit",
  "Photo",
  "Other",
];

/** Badge color classes for each document type. */
export const DOCUMENT_TYPE_STYLES: Record<DocumentType, string> = {
  Blueprint: "bg-blue-100 text-blue-800",
  Layout: "bg-indigo-100 text-indigo-800",
  Contract: "bg-violet-100 text-violet-800",
  Invoice: "bg-emerald-100 text-emerald-800",
  "Change Order": "bg-amber-100 text-amber-800",
  Permit: "bg-sky-100 text-sky-800",
  Photo: "bg-pink-100 text-pink-800",
  Other: "bg-ink-100 text-ink-700",
};

/**
 * Document types the GC most often struggles to find quickly. These are the
 * types eligible for the pinned blueprints/layouts section (see Sprint 3).
 */
export const PINNABLE_PLAN_TYPES: DocumentType[] = ["Blueprint", "Layout"];

/* ---------------------------------------------------------------------------
 * Sprint 3: Contractor action links.
 * ------------------------------------------------------------------------- */

/** All contractor action link types. */
export const ACTION_LINK_TYPES: ActionLinkType[] = [
  "Schedule Confirmation",
  "Completion Submission",
  "Punch Item Update",
  "Document Request",
];

/** All contractor action link statuses. */
export const ACTION_LINK_STATUSES: ActionLinkStatus[] = [
  "Active",
  "Used",
  "Expired",
  "Revoked",
];

/** Badge color classes for each action link status. */
export const ACTION_LINK_STATUS_STYLES: Record<ActionLinkStatus, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Used: "bg-ink-100 text-ink-700",
  Expired: "bg-amber-100 text-amber-800",
  Revoked: "bg-rose-100 text-rose-800",
};

/** Default number of days before a generated action link expires. */
export const ACTION_LINK_DEFAULT_TTL_DAYS = 14;
