import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDb, getFirebaseAuth } from "@/lib/firebase/client";
import type {
  ActivityAction,
  ActivityLog,
  Contractor,
  Project,
  Trade,
  TradePhase,
  TradePhaseStatus,
  TradePhaseWithRelations,
} from "@/lib/database.types";

/**
 * Client-side data access layer for TradeFlow, backed by Cloud Firestore.
 *
 * Every screen talks to Firestore through these helper functions instead of
 * writing queries inline. Firestore is a NoSQL document store with no joins,
 * so for views that need related names (e.g. a trade phase's trade/contractor)
 * we load the related collections and stitch them together in memory. The data
 * set for an MVP is small, so this is simple and fast.
 *
 * Each "create" helper also writes an activity log document so the dashboard
 * can show recent activity. Functions throw on error; calling components catch
 * the error to show an error state.
 *
 * Collections:
 *   projects, contractors, trades, tradePhases, activityLogs, users
 */

const COLLECTIONS = {
  projects: "projects",
  contractors: "contractors",
  trades: "trades",
  tradePhases: "tradePhases",
  activityLogs: "activityLogs",
} as const;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

type Snap = QueryDocumentSnapshot<DocumentData>;

/** Current signed-in user's id, used to stamp created_by / user_id. */
function uid(): string | null {
  return getFirebaseAuth().currentUser?.uid ?? null;
}

/** Converts a Firestore Timestamp (or string) to an ISO date string. */
function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in (value as Record<string, unknown>)
  ) {
    const seconds = (value as { seconds: number }).seconds;
    return new Date(seconds * 1000).toISOString();
  }
  return new Date(value as string).toISOString();
}

/** Best-effort activity logging (never throws — logging is a side effect). */
async function logActivity(input: {
  action_type: ActivityAction;
  entity_type: string;
  entity_id?: string | null;
  project_id?: string | null;
  description: string;
}): Promise<void> {
  try {
    await addDoc(collection(getDb(), COLLECTIONS.activityLogs), {
      action_type: input.action_type,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      project_id: input.project_id ?? null,
      user_id: uid(),
      description: input.description,
      created_at: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Failed to write activity log:", err);
  }
}

// ---------------------------------------------------------------------------
// Mappers (Firestore document -> typed object)
// ---------------------------------------------------------------------------

function mapProject(s: Snap): Project {
  const d = s.data();
  return {
    id: s.id,
    name: d.name,
    location: d.location ?? null,
    start_date: d.start_date ?? null,
    estimated_end_date: d.estimated_end_date ?? null,
    notes: d.notes ?? null,
    created_by: d.created_by ?? null,
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at),
  };
}

function mapContractor(s: Snap): Contractor {
  const d = s.data();
  return {
    id: s.id,
    company_name: d.company_name,
    contact_name: d.contact_name ?? null,
    phone: d.phone ?? null,
    email: d.email ?? null,
    trade_specialty: d.trade_specialty ?? null,
    notes: d.notes ?? null,
    created_by: d.created_by ?? null,
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at),
  };
}

function mapTrade(s: Snap): Trade {
  const d = s.data();
  return {
    id: s.id,
    project_id: d.project_id,
    name: d.name,
    description: d.description ?? null,
    default_contractor_id: d.default_contractor_id ?? null,
    created_by: d.created_by ?? null,
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at),
  };
}

function mapPhase(s: Snap): TradePhase {
  const d = s.data();
  return {
    id: s.id,
    project_id: d.project_id,
    trade_id: d.trade_id,
    contractor_id: d.contractor_id ?? null,
    title: d.title,
    description: d.description ?? null,
    status: d.status as TradePhaseStatus,
    scheduled_start_date: d.scheduled_start_date ?? null,
    scheduled_end_date: d.scheduled_end_date ?? null,
    created_by: d.created_by ?? null,
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at),
  };
}

function mapActivity(s: Snap): ActivityLog {
  const d = s.data();
  return {
    id: s.id,
    action_type: d.action_type,
    entity_type: d.entity_type,
    entity_id: d.entity_id ?? null,
    project_id: d.project_id ?? null,
    user_id: d.user_id ?? null,
    description: d.description,
    created_at: toIso(d.created_at),
  };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(): Promise<Project[]> {
  const snap = await getDocs(
    query(collection(getDb(), COLLECTIONS.projects), orderBy("created_at", "desc")),
  );
  return snap.docs.map(mapProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.projects, id));
  return snap.exists() ? mapProject(snap as Snap) : null;
}

export interface NewProjectInput {
  name: string;
  location?: string;
  start_date?: string;
  estimated_end_date?: string;
  notes?: string;
}

export async function createProject(input: NewProjectInput): Promise<Project> {
  const ref = await addDoc(collection(getDb(), COLLECTIONS.projects), {
    name: input.name,
    location: input.location || null,
    start_date: input.start_date || null,
    estimated_end_date: input.estimated_end_date || null,
    notes: input.notes || null,
    created_by: uid(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  const project = mapProject((await getDoc(ref)) as Snap);
  await logActivity({
    action_type: "project_created",
    entity_type: "project",
    entity_id: project.id,
    project_id: project.id,
    description: `Project "${project.name}" was created`,
  });
  return project;
}

// ---------------------------------------------------------------------------
// Contractors
// ---------------------------------------------------------------------------

export async function listContractors(): Promise<Contractor[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), COLLECTIONS.contractors),
      orderBy("company_name", "asc"),
    ),
  );
  return snap.docs.map(mapContractor);
}

export interface NewContractorInput {
  company_name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  trade_specialty?: string;
  notes?: string;
}

export async function createContractor(
  input: NewContractorInput,
): Promise<Contractor> {
  const ref = await addDoc(collection(getDb(), COLLECTIONS.contractors), {
    company_name: input.company_name,
    contact_name: input.contact_name || null,
    phone: input.phone || null,
    email: input.email || null,
    trade_specialty: input.trade_specialty || null,
    notes: input.notes || null,
    created_by: uid(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  const contractor = mapContractor((await getDoc(ref)) as Snap);
  await logActivity({
    action_type: "contractor_created",
    entity_type: "contractor",
    entity_id: contractor.id,
    description: `Contractor "${contractor.company_name}" was added`,
  });
  return contractor;
}

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

/** Trade row joined with its optional default contractor's name. */
export interface TradeWithContractor extends Trade {
  default_contractor: Pick<Contractor, "id" | "company_name"> | null;
}

export async function listTrades(
  projectId?: string,
): Promise<TradeWithContractor[]> {
  const db = getDb();
  // Load trades and contractors, then join in memory.
  const [tradeSnap, contractors] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.trades), orderBy("name", "asc"))),
    listContractors(),
  ]);
  const contractorById = new Map(contractors.map((c) => [c.id, c]));

  let trades = tradeSnap.docs.map(mapTrade);
  if (projectId) trades = trades.filter((t) => t.project_id === projectId);

  return trades.map((t) => ({
    ...t,
    default_contractor: t.default_contractor_id
      ? (() => {
          const c = contractorById.get(t.default_contractor_id);
          return c ? { id: c.id, company_name: c.company_name } : null;
        })()
      : null,
  }));
}

export interface NewTradeInput {
  project_id: string;
  name: string;
  description?: string;
  default_contractor_id?: string;
}

export async function createTrade(input: NewTradeInput): Promise<Trade> {
  const ref = await addDoc(collection(getDb(), COLLECTIONS.trades), {
    project_id: input.project_id,
    name: input.name,
    description: input.description || null,
    default_contractor_id: input.default_contractor_id || null,
    created_by: uid(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  const trade = mapTrade((await getDoc(ref)) as Snap);
  await logActivity({
    action_type: "trade_created",
    entity_type: "trade",
    entity_id: trade.id,
    project_id: trade.project_id,
    description: `Trade "${trade.name}" was created`,
  });
  return trade;
}

// ---------------------------------------------------------------------------
// Trade phases (the core workflow item)
// ---------------------------------------------------------------------------

export interface PhaseFilters {
  projectId?: string;
  status?: TradePhaseStatus;
  tradeId?: string;
}

/** Attaches trade/contractor/project name subsets to a base phase. */
function attachRelations(
  phase: TradePhase,
  trades: Map<string, Trade>,
  contractors: Map<string, Contractor>,
  projects: Map<string, Project>,
): TradePhaseWithRelations {
  const trade = trades.get(phase.trade_id);
  const contractor = phase.contractor_id
    ? contractors.get(phase.contractor_id)
    : null;
  const project = projects.get(phase.project_id);
  return {
    ...phase,
    trade: trade ? { id: trade.id, name: trade.name } : null,
    contractor: contractor
      ? { id: contractor.id, company_name: contractor.company_name }
      : null,
    project: project ? { id: project.id, name: project.name } : null,
  };
}

export async function listTradePhases(
  filters: PhaseFilters = {},
): Promise<TradePhaseWithRelations[]> {
  const db = getDb();
  // Load phases plus the collections we need to resolve names, then join.
  const [phaseSnap, tradeSnap, contractorSnap, projectSnap] = await Promise.all(
    [
      getDocs(
        query(
          collection(db, COLLECTIONS.tradePhases),
          orderBy("created_at", "desc"),
        ),
      ),
      getDocs(collection(db, COLLECTIONS.trades)),
      getDocs(collection(db, COLLECTIONS.contractors)),
      getDocs(collection(db, COLLECTIONS.projects)),
    ],
  );

  const trades = new Map(tradeSnap.docs.map((s) => [s.id, mapTrade(s)]));
  const contractors = new Map(
    contractorSnap.docs.map((s) => [s.id, mapContractor(s)]),
  );
  const projects = new Map(projectSnap.docs.map((s) => [s.id, mapProject(s)]));

  let phases = phaseSnap.docs.map((s) =>
    attachRelations(mapPhase(s), trades, contractors, projects),
  );

  // Apply filters in memory (keeps us free of composite indexes).
  if (filters.projectId)
    phases = phases.filter((p) => p.project_id === filters.projectId);
  if (filters.status)
    phases = phases.filter((p) => p.status === filters.status);
  if (filters.tradeId)
    phases = phases.filter((p) => p.trade_id === filters.tradeId);

  return phases;
}

export async function getTradePhase(
  id: string,
): Promise<TradePhaseWithRelations | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, COLLECTIONS.tradePhases, id));
  if (!snap.exists()) return null;
  const phase = mapPhase(snap as Snap);

  // Fetch only the related docs this phase references.
  const [tradeDoc, contractorDoc, projectDoc] = await Promise.all([
    getDoc(doc(db, COLLECTIONS.trades, phase.trade_id)),
    phase.contractor_id
      ? getDoc(doc(db, COLLECTIONS.contractors, phase.contractor_id))
      : Promise.resolve(null),
    getDoc(doc(db, COLLECTIONS.projects, phase.project_id)),
  ]);

  return {
    ...phase,
    trade:
      tradeDoc && tradeDoc.exists()
        ? { id: tradeDoc.id, name: tradeDoc.data().name }
        : null,
    contractor:
      contractorDoc && contractorDoc.exists()
        ? { id: contractorDoc.id, company_name: contractorDoc.data().company_name }
        : null,
    project:
      projectDoc && projectDoc.exists()
        ? { id: projectDoc.id, name: projectDoc.data().name }
        : null,
  };
}

export interface NewTradePhaseInput {
  project_id: string;
  trade_id: string;
  contractor_id?: string;
  title: string;
  description?: string;
  status: TradePhaseStatus;
  scheduled_start_date?: string;
  scheduled_end_date?: string;
}

export async function createTradePhase(
  input: NewTradePhaseInput,
): Promise<TradePhase> {
  const ref = await addDoc(collection(getDb(), COLLECTIONS.tradePhases), {
    project_id: input.project_id,
    trade_id: input.trade_id,
    contractor_id: input.contractor_id || null,
    title: input.title,
    description: input.description || null,
    status: input.status,
    scheduled_start_date: input.scheduled_start_date || null,
    scheduled_end_date: input.scheduled_end_date || null,
    created_by: uid(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  const phase = mapPhase((await getDoc(ref)) as Snap);
  await logActivity({
    action_type: "trade_phase_created",
    entity_type: "trade_phase",
    entity_id: phase.id,
    project_id: phase.project_id,
    description: `Trade phase "${phase.title}" was created`,
  });
  return phase;
}

export async function updateTradePhaseStatus(
  id: string,
  status: TradePhaseStatus,
): Promise<TradePhase> {
  const ref = doc(getDb(), COLLECTIONS.tradePhases, id);
  await updateDoc(ref, { status, updated_at: serverTimestamp() });
  const phase = mapPhase((await getDoc(ref)) as Snap);
  await logActivity({
    action_type: "trade_phase_status_updated",
    entity_type: "trade_phase",
    entity_id: phase.id,
    project_id: phase.project_id,
    description: `"${phase.title}" status changed to ${status}`,
  });
  return phase;
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export async function listRecentActivity(limit = 10): Promise<ActivityLog[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), COLLECTIONS.activityLogs),
      orderBy("created_at", "desc"),
      fsLimit(limit),
    ),
  );
  return snap.docs.map(mapActivity);
}
