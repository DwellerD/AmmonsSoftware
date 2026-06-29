/**
 * TradeFlow data model (TypeScript view of the Firestore collections).
 *
 * These interfaces describe the shape of documents stored in Cloud Firestore.
 * They are intentionally hand-written and kept simple so a new developer can
 * read them alongside src/lib/api.ts and understand the whole model.
 */

/** Roles a user can have. Drives what each person can see/do in the app. */
export type UserRole = "admin" | "gc_site_super" | "internal_team" | "contractor";

/** The lifecycle a piece of trade work moves through. */
export type TradePhaseStatus =
  | "Not Ready"
  | "Materials Pending"
  | "Ready to Schedule"
  | "Scheduled"
  | "In Progress"
  | "Submitted Complete"
  | "Needs Inspection"
  | "Approved"
  | "Blocked";

/** Kinds of actions we record in the activity log. */
export type ActivityAction =
  | "project_created"
  | "trade_created"
  | "contractor_created"
  | "trade_phase_created"
  | "trade_phase_status_updated"
  | "material_order_added"
  | "material_order_status_updated"
  | "completion_submitted"
  | "inspection_recorded"
  | "punch_item_created"
  | "punch_item_resolved"
  | "document_uploaded"
  | "document_pinned"
  | "document_unpinned"
  | "schedule_confirmation_requested"
  | "schedule_confirmed"
  | "schedule_declined"
  | "punch_item_updated";

/** Where a material order stands in the procurement/delivery process. */
export type MaterialOrderStatus =
  | "Needed"
  | "Ordered"
  | "Arriving"
  | "Received"
  | "Delayed"
  | "Cancelled";

/** Outcome of a GC inspection on a trade phase. */
export type InspectionResult = "Passed" | "Failed" | "Needs Rework";

/** Lifecycle of a completion submission (proof that work is done). */
export type CompletionStatus =
  | "Submitted"
  | "Approved"
  | "Rejected"
  | "Needs Fix";

/** Lifecycle of a punch-list item (a defect or fix to close out). */
export type PunchItemStatus = "Open" | "In Progress" | "Resolved" | "Closed";

/** Priority/severity of a punch-list item. */
export type PunchPriority = "Low" | "Medium" | "High" | "Critical";

/** A user account profile, linked 1:1 with a Firebase auth user. */
export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

/** A construction project (e.g. a 40-unit apartment build). */
export interface Project {
  id: string;
  name: string;
  location: string | null;
  start_date: string | null;
  estimated_end_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A trade discipline within a project (framing, plumbing, etc.). */
export interface Trade {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  default_contractor_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A contractor/company that can be assigned to trade phases. */
export interface Contractor {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  trade_specialty: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** The core workflow item: a specific piece of work to track. */
export type ScheduleConfirmationStatus = "Pending" | "Confirmed" | "Declined";

export interface TradePhase {
  id: string;
  project_id: string;
  trade_id: string;
  contractor_id: string | null;
  title: string;
  description: string | null;
  status: TradePhaseStatus;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  /**
   * Whether the assigned contractor has confirmed the scheduled dates
   * (Sprint 3). Null means no confirmation has been requested yet.
   */
  schedule_confirmation_status: ScheduleConfirmationStatus | null;
  /** Optional reason the contractor gave when declining the schedule. */
  schedule_confirmation_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** An audit-trail entry describing something that happened in the app. */
export interface ActivityLog {
  id: string;
  action_type: ActivityAction;
  entity_type: string;
  entity_id: string | null;
  project_id: string | null;
  user_id: string | null;
  description: string;
  created_at: string;
}

/**
 * Convenience type for a trade phase joined with its related records.
 * Used by list and detail views so we can show trade/contractor names.
 */
export interface TradePhaseWithRelations extends TradePhase {
  trade: Pick<Trade, "id" | "name"> | null;
  contractor: Pick<Contractor, "id" | "company_name"> | null;
  project: Pick<Project, "id" | "name"> | null;
}

/* ---------------------------------------------------------------------------
 * Sprint 2: material tracking, completion proof, inspections, punch items.
 * Each of these belongs to a single trade phase (via trade_phase_id) and also
 * stores project_id so the data can be rolled up per project later.
 * ------------------------------------------------------------------------- */

/**
 * A material order tracked for a project, optionally tied to a specific trade
 * phase and/or trade. Captures procurement and delivery progress.
 */
export interface MaterialOrder {
  id: string;
  name: string;
  supplier: string | null;
  expected_arrival_date: string | null;
  actual_arrival_date: string | null;
  status: MaterialOrderStatus;
  notes: string | null;
  project_id: string;
  trade_phase_id: string | null;
  trade_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Proof that work on a trade phase is complete: notes + photos in Storage. */
export interface CompletionRecord {
  id: string;
  trade_phase_id: string;
  project_id: string;
  submitted_by: string | null;
  notes: string | null;
  /** Firebase Storage download URLs for the uploaded completion photos. */
  photo_urls: string[];
  status: CompletionStatus;
  submitted_at: string;
  /** GC review notes, set when the submission is approved or rejected. */
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A GC inspection result recorded against a trade phase. */
export interface Inspection {
  id: string;
  trade_phase_id: string;
  project_id: string;
  result: InspectionResult;
  notes: string | null;
  inspector_id: string | null;
  created_at: string;
}

/** A punch-list item: a defect or task to close out a trade phase. */
export interface PunchItem {
  id: string;
  trade_phase_id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_contractor_id: string | null;
  due_date: string | null;
  priority: PunchPriority;
  status: PunchItemStatus;
  /** Latest note left by the contractor when updating the item (Sprint 3). */
  contractor_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

/** Kinds of in-app notification we record for Sprint 2 events. */
export type NotificationType =
  | "completion_submitted"
  | "punch_item_assigned"
  | "material_delayed";

/** Read state of a notification record. */
export type NotificationStatus = "unread" | "read";

/**
 * An in-app notification record. Sprint 2 does not send real SMS/email/push;
 * these records simply capture what *would* be sent, so the workflow can be
 * built and tested. Recipient may be a user or contractor id (or null for a
 * broadcast to whoever is managing the project).
 */
export interface Notification {
  id: string;
  recipient_id: string | null;
  notification_type: NotificationType;
  related_entity_type: string;
  related_entity_id: string;
  message: string;
  status: NotificationStatus;
  created_at: string;
}

/* ---------------------------------------------------------------------------
 * Sprint 3: Document Vault.
 * A project document is a file (blueprint, contract, invoice, etc.) stored in
 * Firebase Storage with its metadata kept here in Firestore. Documents always
 * belong to a project and may optionally link to a trade, trade phase,
 * contractor, or punch item so they can be surfaced in the right places.
 * ------------------------------------------------------------------------- */

/** The kinds of document the vault understands. */
export type DocumentType =
  | "Blueprint"
  | "Layout"
  | "Contract"
  | "Invoice"
  | "Change Order"
  | "Permit"
  | "Photo"
  | "Other";

/** A project document record (file metadata; the file lives in Storage). */
export interface ProjectDocument {
  id: string;
  /** Human-friendly document name shown in the vault. */
  name: string;
  document_type: DocumentType;
  project_id: string;
  /** Optional links to related entities (any may be null). */
  trade_id: string | null;
  trade_phase_id: string | null;
  contractor_id: string | null;
  punch_item_id: string | null;
  /** Firebase Storage download URL for the file. */
  file_url: string;
  /** Path of the file within the Storage bucket (used for deletes/lookups). */
  storage_path: string;
  uploaded_by: string | null;
  /** Free-form tags for search/filtering. */
  tags: string[];
  /** Pinned documents are surfaced near the top of the vault. */
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

/* ---------------------------------------------------------------------------
 * Sprint 3: Contractor action links.
 * A lightweight, tokenized link the GC can hand to a contractor so they can
 * take a single scoped action (confirm a schedule, submit completion, update a
 * punch item, or respond to a document request) without needing a full account
 * or access to unrelated project data.
 * ------------------------------------------------------------------------- */

/** The action a contractor link grants. */
export type ActionLinkType =
  | "Schedule Confirmation"
  | "Completion Submission"
  | "Punch Item Update"
  | "Document Request";

/** Lifecycle status of a contractor action link. */
export type ActionLinkStatus = "Active" | "Used" | "Expired" | "Revoked";

/** The kind of entity a link points at. */
export type ActionLinkEntityType =
  | "trade_phase"
  | "punch_item"
  | "completion_record"
  | "document_request";

/**
 * A tokenized contractor action link. The document id IS the token, so a link
 * can only be opened by someone who has the (unguessable) token; the vault/list
 * of links is never exposed publicly.
 */
export interface ContractorActionLink {
  id: string;
  /** Unguessable token; equals the document id. */
  token: string;
  action_type: ActionLinkType;
  related_entity_type: ActionLinkEntityType;
  related_entity_id: string;
  contractor_id: string;
  project_id: string;
  /** ISO date after which the link is no longer valid (null = never expires). */
  expiration_date: string | null;
  /** When the link was first used to complete its action (null until used). */
  used_at: string | null;
  status: ActionLinkStatus;
  created_at: string;
  updated_at: string;
}

