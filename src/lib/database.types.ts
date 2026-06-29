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
  | "trade_phase_status_updated";

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
