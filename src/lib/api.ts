import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDb, getFirebaseAuth, getFirebaseStorage } from "@/lib/firebase/client";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
} from "firebase/storage";
import { buildDocumentStoragePath } from "@/lib/documents";
import {
  defaultExpiration,
  entityTypeForAction,
  generateActionToken,
} from "@/lib/actionLinks";
import type {
  ActionLinkEntityType,
  ActionLinkStatus,
  ActionLinkType,
  ActivityAction,
  ActivityLog,
  CompletionRecord,
  CompletionStatus,
  Contractor,
  ContractorActionLink,
  DocumentType,
  Inspection,
  InspectionResult,
  MaterialOrder,
  MaterialOrderStatus,
  Notification,
  NotificationDeliveryStatus,
  NotificationStatus,
  NotificationType,
  Project,
  ProjectDocument,
  PunchItem,
  PunchItemStatus,
  PunchPriority,
  ScheduleConfirmationStatus,
  Trade,
  TradePhase,
  TradePhaseStatus,
  TradePhaseWithRelations,
} from "@/lib/database.types";
import { todayIso } from "@/lib/format";

/**
 * Client-side data access layer for PhaseBinder, backed by Cloud Firestore.
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
  materialOrders: "materialOrders",
  completionRecords: "completionRecords",
  inspections: "inspections",
  punchItems: "punchItems",
  notifications: "notifications",
  documents: "documents",
  contractorActionLinks: "contractorActionLinks",
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
    schedule_confirmation_status: d.schedule_confirmation_status ?? null,
    schedule_confirmation_note: d.schedule_confirmation_note ?? null,
    original_scheduled_end_date: d.original_scheduled_end_date ?? null,
    schedule_extension_note: d.schedule_extension_note ?? null,
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

export interface UpdateContractorInput {
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

/** Updates editable contractor details in place. */
export async function updateContractor(
  id: string,
  input: UpdateContractorInput,
): Promise<Contractor> {
  const ref = doc(getDb(), COLLECTIONS.contractors, id);
  await updateDoc(ref, {
    company_name: input.company_name,
    contact_name: input.contact_name || null,
    phone: input.phone || null,
    email: input.email || null,
    trade_specialty: input.trade_specialty || null,
    notes: input.notes || null,
    updated_at: serverTimestamp(),
  });
  return mapContractor((await getDoc(ref)) as Snap);
}

/** Deletes a contractor record. */
export async function deleteContractor(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTIONS.contractors, id));
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

export interface UpdateTradeInput {
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

/** Updates editable trade fields in place. */
export async function updateTrade(
  id: string,
  input: UpdateTradeInput,
): Promise<Trade> {
  const ref = doc(getDb(), COLLECTIONS.trades, id);
  await updateDoc(ref, {
    project_id: input.project_id,
    name: input.name,
    description: input.description || null,
    default_contractor_id: input.default_contractor_id || null,
    updated_at: serverTimestamp(),
  });
  return mapTrade((await getDoc(ref)) as Snap);
}

/** Deletes a trade record. */
export async function deleteTrade(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTIONS.trades, id));
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

const AUTO_NEEDS_INSPECTION_FROM: ReadonlyArray<TradePhaseStatus> = [
  "Scheduled",
  "In Progress",
  "Submitted Complete",
];

function shouldAutoMoveToNeedsInspection(
  phase: TradePhase,
  today: string,
): boolean {
  return Boolean(
    phase.scheduled_end_date &&
      phase.scheduled_end_date <= today &&
      AUTO_NEEDS_INSPECTION_FROM.includes(phase.status),
  );
}

async function applyAutomaticNeedsInspection(
  phase: TradePhase,
  today: string,
): Promise<TradePhase> {
  if (!shouldAutoMoveToNeedsInspection(phase, today)) return phase;

  try {
    const ref = doc(getDb(), COLLECTIONS.tradePhases, phase.id);
    await updateDoc(ref, {
      status: "Needs Inspection" as TradePhaseStatus,
      updated_at: serverTimestamp(),
    });
    await logActivity({
      action_type: "trade_phase_status_updated",
      entity_type: "trade_phase",
      entity_id: phase.id,
      project_id: phase.project_id,
      description: `"${phase.title}" status auto-changed to Needs Inspection on scheduled end`,
    });
    return {
      ...phase,
      status: "Needs Inspection",
      updated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("Failed to auto-transition phase status:", err);
    return phase;
  }
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

  const today = todayIso();
  const normalizedPhases = await Promise.all(
    phaseSnap.docs.map((s) => applyAutomaticNeedsInspection(mapPhase(s), today)),
  );

  let phases = normalizedPhases.map((phase) =>
    attachRelations(phase, trades, contractors, projects),
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
  const phase = await applyAutomaticNeedsInspection(mapPhase(snap as Snap), todayIso());

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
    original_scheduled_end_date: null,
    schedule_extension_note: null,
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

/**
 * Extends a phase's scheduled end date while preserving the original baseline
 * date for auditability in the overview panel.
 */
export async function extendTradePhaseEndDate(
  id: string,
  nextEndDate: string,
  note?: string,
): Promise<TradePhase> {
  const ref = doc(getDb(), COLLECTIONS.tradePhases, id);
  const beforeSnap = await getDoc(ref);
  if (!beforeSnap.exists()) {
    throw new Error("Trade phase not found.");
  }
  const before = mapPhase(beforeSnap as Snap);
  await updateDoc(ref, {
    original_scheduled_end_date:
      before.original_scheduled_end_date ?? before.scheduled_end_date ?? null,
    scheduled_end_date: nextEndDate,
    schedule_extension_note: note?.trim() ? note.trim() : null,
    updated_at: serverTimestamp(),
  });
  const phase = mapPhase((await getDoc(ref)) as Snap);
  await logActivity({
    action_type: "trade_phase_status_updated",
    entity_type: "trade_phase",
    entity_id: phase.id,
    project_id: phase.project_id,
    description: `"${phase.title}" end date extended to ${nextEndDate}`,
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

// ===========================================================================
// Sprint 2: materials, completion proof, inspections, punch items.
//
// These collections are each scoped to one trade phase. We query by
// trade_phase_id (an equality filter, which uses Firestore's automatic
// single-field index) and sort in memory to avoid composite indexes.
// ===========================================================================

function mapMaterialOrder(s: Snap): MaterialOrder {
  const d = s.data();
  return {
    id: s.id,
    name: d.name,
    supplier: d.supplier ?? null,
    tracking_number: d.tracking_number ?? null,
    cost: typeof d.cost === "number" ? d.cost : null,
    expected_arrival_date: d.expected_arrival_date ?? null,
    actual_arrival_date: d.actual_arrival_date ?? null,
    status: d.status as MaterialOrderStatus,
    notes: d.notes ?? null,
    project_id: d.project_id,
    trade_phase_id: d.trade_phase_id ?? null,
    trade_id: d.trade_id ?? null,
    created_by: d.created_by ?? null,
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at),
  };
}

function mapCompletion(s: Snap): CompletionRecord {
  const d = s.data();
  return {
    id: s.id,
    trade_phase_id: d.trade_phase_id,
    project_id: d.project_id,
    submitted_by: d.submitted_by ?? null,
    notes: d.notes ?? null,
    photo_urls: Array.isArray(d.photo_urls) ? d.photo_urls : [],
    status: (d.status as CompletionStatus) ?? "Submitted",
    submitted_at: toIso(d.submitted_at ?? d.created_at),
    review_notes: d.review_notes ?? null,
    reviewed_by: d.reviewed_by ?? null,
    reviewed_at: d.reviewed_at ? toIso(d.reviewed_at) : null,
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at ?? d.created_at),
  };
}

function mapInspection(s: Snap): Inspection {
  const d = s.data();
  return {
    id: s.id,
    trade_phase_id: d.trade_phase_id,
    project_id: d.project_id,
    result: d.result as InspectionResult,
    notes: d.notes ?? null,
    inspector_id: d.inspector_id ?? null,
    created_at: toIso(d.created_at),
  };
}

function mapPunchItem(s: Snap): PunchItem {
  const d = s.data();
  return {
    id: s.id,
    trade_phase_id: d.trade_phase_id,
    project_id: d.project_id,
    title: d.title ?? d.description ?? "",
    description: d.description ?? null,
    assigned_contractor_id: d.assigned_contractor_id ?? null,
    due_date: d.due_date ?? null,
    priority: (d.priority ?? "Medium") as PunchPriority,
    status: d.status as PunchItemStatus,
    contractor_notes: d.contractor_notes ?? null,
    created_by: d.created_by ?? null,
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at),
    resolved_at: d.resolved_at ? toIso(d.resolved_at) : null,
  };
}

/** Loads all docs in a collection for one trade phase, oldest first. */
async function listForPhase(
  collectionName: string,
  tradePhaseId: string,
): Promise<Snap[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), collectionName),
      where("trade_phase_id", "==", tradePhaseId),
    ),
  );
  return [...snap.docs].sort((a, b) => {
    const at = a.data().created_at;
    const bt = b.data().created_at;
    const av = typeof at === "object" && at?.seconds ? at.seconds : 0;
    const bv = typeof bt === "object" && bt?.seconds ? bt.seconds : 0;
    return av - bv;
  });
}

// ---------------------------------------------------------------------------
// Material orders
// ---------------------------------------------------------------------------

export interface MaterialOrderFilters {
  projectId?: string;
  tradePhaseId?: string;
  tradeId?: string;
}

/**
 * Lists material orders, optionally filtered by project, trade phase, or trade.
 * Fetches the collection and filters/sorts in memory (oldest first) to stay
 * free of composite indexes, consistent with the rest of the app.
 */
export async function listMaterialOrders(
  filters: MaterialOrderFilters = {},
): Promise<MaterialOrder[]> {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.materialOrders));
  let orders = snap.docs
    .map(mapMaterialOrder)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  if (filters.projectId)
    orders = orders.filter((o) => o.project_id === filters.projectId);
  if (filters.tradePhaseId)
    orders = orders.filter((o) => o.trade_phase_id === filters.tradePhaseId);
  if (filters.tradeId)
    orders = orders.filter((o) => o.trade_id === filters.tradeId);

  return orders;
}

export interface NewMaterialOrderInput {
  project_id: string;
  trade_phase_id?: string;
  trade_id?: string;
  name: string;
  supplier?: string;
  tracking_number?: string;
  cost?: number;
  status: MaterialOrderStatus;
  expected_arrival_date?: string;
  actual_arrival_date?: string;
  notes?: string;
}

export interface UpdateMaterialOrderInput {
  name: string;
  supplier?: string;
  tracking_number?: string;
  cost?: number;
  status: MaterialOrderStatus;
  expected_arrival_date?: string;
  actual_arrival_date?: string;
  notes?: string;
}

export async function createMaterialOrder(
  input: NewMaterialOrderInput,
): Promise<MaterialOrder> {
  const ref = await addDoc(collection(getDb(), COLLECTIONS.materialOrders), {
    name: input.name,
    supplier: input.supplier || null,
    tracking_number: input.tracking_number || null,
    cost: typeof input.cost === "number" ? input.cost : null,
    expected_arrival_date: input.expected_arrival_date || null,
    actual_arrival_date: input.actual_arrival_date || null,
    status: input.status,
    notes: input.notes || null,
    project_id: input.project_id,
    trade_phase_id: input.trade_phase_id || null,
    trade_id: input.trade_id || null,
    created_by: uid(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  const order = mapMaterialOrder((await getDoc(ref)) as Snap);
  await logActivity({
    action_type: "material_order_added",
    entity_type: "material_order",
    entity_id: order.id,
    project_id: order.project_id,
    description: `Material order "${order.name}" added`,
  });
  return order;
}

/** Loads one material order by id, or null if it doesn't exist. */
export async function getMaterialOrder(
  id: string,
): Promise<MaterialOrder | null> {
  const ref = doc(getDb(), COLLECTIONS.materialOrders, id);
  const snap = await getDoc(ref);
  return snap.exists() ? mapMaterialOrder(snap as Snap) : null;
}

/** Updates editable material order details in place. */
export async function updateMaterialOrder(
  id: string,
  input: UpdateMaterialOrderInput,
): Promise<MaterialOrder> {
  const ref = doc(getDb(), COLLECTIONS.materialOrders, id);
  const before = await getMaterialOrder(id);
  await updateDoc(ref, {
    name: input.name,
    supplier: input.supplier || null,
    tracking_number: input.tracking_number || null,
    cost: typeof input.cost === "number" ? input.cost : null,
    status: input.status,
    expected_arrival_date: input.expected_arrival_date || null,
    actual_arrival_date: input.actual_arrival_date || null,
    notes: input.notes || null,
    updated_at: serverTimestamp(),
  });
  const order = mapMaterialOrder((await getDoc(ref)) as Snap);
  if (before?.status !== input.status) {
    await logActivity({
      action_type: "material_order_status_updated",
      entity_type: "material_order",
      entity_id: order.id,
      project_id: order.project_id,
      description: `Material order "${order.name}" marked ${input.status}`,
    });
  }
  if (before?.status !== "Delayed" && input.status === "Delayed") {
    await createNotification({
      notification_type: "material_delayed",
      related_entity_type: "material_order",
      related_entity_id: order.id,
      message: `Material order "${order.name}" is delayed.`,
    });
  }
  return order;
}

/** Deletes a material order record. */
export async function deleteMaterialOrder(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTIONS.materialOrders, id));
}

export async function updateMaterialOrderStatus(
  id: string,
  status: MaterialOrderStatus,
): Promise<MaterialOrder> {
  const ref = doc(getDb(), COLLECTIONS.materialOrders, id);
  await updateDoc(ref, { status, updated_at: serverTimestamp() });
  const order = mapMaterialOrder((await getDoc(ref)) as Snap);
  await logActivity({
    action_type: "material_order_status_updated",
    entity_type: "material_order",
    entity_id: order.id,
    project_id: order.project_id,
    description: `Material order "${order.name}" marked ${status}`,
  });
  // Flag delayed deliveries so the GC can react.
  if (status === "Delayed") {
    await createNotification({
      notification_type: "material_delayed",
      related_entity_type: "material_order",
      related_entity_id: order.id,
      message: `Material order "${order.name}" is delayed.`,
    });
  }
  return order;
}

// ---------------------------------------------------------------------------
// Completion proof
// ---------------------------------------------------------------------------

export async function listCompletionRecords(
  tradePhaseId: string,
): Promise<CompletionRecord[]> {
  const docs = await listForPhase(COLLECTIONS.completionRecords, tradePhaseId);
  return docs.map(mapCompletion);
}

/**
 * Uploads completion photos to Firebase Storage under
 * `completion/{tradePhaseId}/` and returns their download URLs. Used by the
 * contractor submission flow before the Firestore record is written.
 */
export async function uploadCompletionPhotos(
  tradePhaseId: string,
  files: File[],
): Promise<string[]> {
  const storage = getFirebaseStorage();
  const urls: string[] = [];
  for (const [i, file] of files.entries()) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `completion/${tradePhaseId}/${Date.now()}-${i}-${safeName}`;
    const r = storageRef(storage, path);
    await uploadBytes(r, file, { contentType: file.type });
    urls.push(await getDownloadURL(r));
  }
  return urls;
}

export interface NewCompletionInput {
  trade_phase_id: string;
  project_id: string;
  notes?: string;
  photo_urls?: string[];
}

/**
 * Records completion proof and advances the phase to "Submitted Complete"
 * (unless it has already been approved). Photos are uploaded to Firebase
 * Storage first; their download URLs are stored on the record.
 */
export async function createCompletionRecord(
  input: NewCompletionInput,
): Promise<CompletionRecord> {
  const ref = await addDoc(collection(getDb(), COLLECTIONS.completionRecords), {
    trade_phase_id: input.trade_phase_id,
    project_id: input.project_id,
    submitted_by: uid(),
    notes: input.notes || null,
    photo_urls: input.photo_urls ?? [],
    status: "Submitted" as CompletionStatus,
    submitted_at: serverTimestamp(),
    review_notes: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  const record = mapCompletion((await getDoc(ref)) as Snap);

  // Advance the phase status unless it is already approved.
  const phaseSnap = await getDoc(
    doc(getDb(), COLLECTIONS.tradePhases, input.trade_phase_id),
  );
  if (phaseSnap.exists() && phaseSnap.data().status !== "Approved") {
    await updateTradePhaseStatus(input.trade_phase_id, "Submitted Complete");
  }

  await logActivity({
    action_type: "completion_submitted",
    entity_type: "trade_phase",
    entity_id: input.trade_phase_id,
    project_id: input.project_id,
    description: "Completion proof submitted",
  });
  await createNotification({
    notification_type: "completion_submitted",
    related_entity_type: "completion_record",
    related_entity_id: record.id,
    message: "Completion proof was submitted for review.",
  });
  return record;
}

export interface ReviewCompletionInput {
  trade_phase_id: string;
  project_id: string;
  decision: "approve" | "reject";
  /** Required for a rejection: what the contractor needs to fix. */
  notes?: string;
}

/**
 * GC review of a completion submission. Approving marks the submission and the
 * phase "Approved"; rejecting marks the submission "Needs Fix" and moves the
 * phase back to "In Progress". Either way an inspection record is written for
 * the audit trail and an activity entry is logged.
 */
export async function reviewCompletion(
  recordId: string,
  input: ReviewCompletionInput,
): Promise<CompletionRecord> {
  const approved = input.decision === "approve";
  const status: CompletionStatus = approved ? "Approved" : "Needs Fix";

  const ref = doc(getDb(), COLLECTIONS.completionRecords, recordId);
  await updateDoc(ref, {
    status,
    review_notes: input.notes || null,
    reviewed_by: uid(),
    reviewed_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  const record = mapCompletion((await getDoc(ref)) as Snap);

  // Approved work is done; rejected work goes back for fixes.
  await updateTradePhaseStatus(
    input.trade_phase_id,
    approved ? "Approved" : "In Progress",
  );

  // Record the inspection outcome for the audit trail.
  await addDoc(collection(getDb(), COLLECTIONS.inspections), {
    trade_phase_id: input.trade_phase_id,
    project_id: input.project_id,
    result: approved ? "Passed" : "Needs Rework",
    notes: input.notes || null,
    inspector_id: uid(),
    created_at: serverTimestamp(),
  });

  await logActivity({
    action_type: "inspection_recorded",
    entity_type: "trade_phase",
    entity_id: input.trade_phase_id,
    project_id: input.project_id,
    description: approved
      ? "Completion approved"
      : "Completion rejected — needs fix",
  });
  return record;
}

// ---------------------------------------------------------------------------
// Inspections (GC approval)
// ---------------------------------------------------------------------------

export async function listInspections(
  tradePhaseId: string,
): Promise<Inspection[]> {
  const docs = await listForPhase(COLLECTIONS.inspections, tradePhaseId);
  return docs.map(mapInspection);
}

export interface NewInspectionInput {
  trade_phase_id: string;
  project_id: string;
  result: InspectionResult;
  notes?: string;
}

/**
 * Records a GC inspection. A "Passed" result approves the phase; "Failed" or
 * "Needs Rework" moves it back to "Blocked".
 */
export async function createInspection(
  input: NewInspectionInput,
): Promise<Inspection> {
  const ref = await addDoc(collection(getDb(), COLLECTIONS.inspections), {
    trade_phase_id: input.trade_phase_id,
    project_id: input.project_id,
    result: input.result,
    notes: input.notes || null,
    inspector_id: uid(),
    created_at: serverTimestamp(),
  });
  const inspection = mapInspection((await getDoc(ref)) as Snap);

  const nextStatus: TradePhaseStatus =
    input.result === "Passed" ? "Approved" : "Blocked";
  await updateTradePhaseStatus(input.trade_phase_id, nextStatus);

  await logActivity({
    action_type: "inspection_recorded",
    entity_type: "trade_phase",
    entity_id: input.trade_phase_id,
    project_id: input.project_id,
    description: `Inspection recorded: ${input.result}`,
  });
  return inspection;
}

// ---------------------------------------------------------------------------
// Punch items
// ---------------------------------------------------------------------------

export async function listPunchItems(
  tradePhaseId: string,
): Promise<PunchItem[]> {
  const docs = await listForPhase(COLLECTIONS.punchItems, tradePhaseId);
  return docs.map(mapPunchItem);
}

export interface PunchItemFilters {
  projectId?: string;
  status?: PunchItemStatus;
  contractorId?: string;
}

/** Lists every punch item across all phases, newest first, with filters. */
export async function listAllPunchItems(
  filters: PunchItemFilters = {},
): Promise<PunchItem[]> {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.punchItems));
  let items = snap.docs
    .map(mapPunchItem)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  if (filters.projectId)
    items = items.filter((i) => i.project_id === filters.projectId);
  if (filters.status) items = items.filter((i) => i.status === filters.status);
  if (filters.contractorId)
    items = items.filter((i) => i.assigned_contractor_id === filters.contractorId);

  return items;
}

export interface NewPunchItemInput {
  trade_phase_id: string;
  project_id: string;
  title: string;
  description?: string;
  assigned_contractor_id?: string;
  due_date?: string;
  priority?: PunchPriority;
  status?: PunchItemStatus;
}

export async function createPunchItem(
  input: NewPunchItemInput,
): Promise<PunchItem> {
  const status = input.status ?? "Open";
  const ref = await addDoc(collection(getDb(), COLLECTIONS.punchItems), {
    trade_phase_id: input.trade_phase_id,
    project_id: input.project_id,
    title: input.title,
    description: input.description || null,
    assigned_contractor_id: input.assigned_contractor_id || null,
    due_date: input.due_date || null,
    priority: input.priority ?? "Medium",
    status,
    resolved_at:
      status === "Resolved" || status === "Closed" ? serverTimestamp() : null,
    created_by: uid(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  const item = mapPunchItem((await getDoc(ref)) as Snap);
  await logActivity({
    action_type: "punch_item_created",
    entity_type: "punch_item",
    entity_id: item.id,
    project_id: item.project_id,
    description: `Punch item added: ${item.title}`,
  });
  return item;
}

export async function updatePunchItemStatus(
  id: string,
  status: PunchItemStatus,
): Promise<PunchItem> {
  const ref = doc(getDb(), COLLECTIONS.punchItems, id);
  const resolving = status === "Resolved" || status === "Closed";
  await updateDoc(ref, {
    status,
    resolved_at: resolving ? serverTimestamp() : null,
    updated_at: serverTimestamp(),
  });
  const item = mapPunchItem((await getDoc(ref)) as Snap);
  if (status === "Resolved") {
    await logActivity({
      action_type: "punch_item_resolved",
      entity_type: "punch_item",
      entity_id: item.id,
      project_id: item.project_id,
      description: `Punch item resolved: ${item.title}`,
    });
  }
  return item;
}

export interface UpdatePunchItemInput {
  title: string;
  description?: string;
  assigned_contractor_id?: string;
  due_date?: string;
  priority: PunchPriority;
  status: PunchItemStatus;
}

/** Updates editable punch-item details from GC screens. */
export async function updatePunchItem(
  id: string,
  input: UpdatePunchItemInput,
): Promise<PunchItem> {
  const ref = doc(getDb(), COLLECTIONS.punchItems, id);
  const resolving = input.status === "Resolved" || input.status === "Closed";
  await updateDoc(ref, {
    title: input.title,
    description: input.description || null,
    assigned_contractor_id: input.assigned_contractor_id || null,
    due_date: input.due_date || null,
    priority: input.priority,
    status: input.status,
    resolved_at: resolving ? serverTimestamp() : null,
    updated_at: serverTimestamp(),
  });
  return mapPunchItem((await getDoc(ref)) as Snap);
}

/** Loads a single punch item by id, or null if it doesn't exist. */
export async function getPunchItem(id: string): Promise<PunchItem | null> {
  const ref = doc(getDb(), COLLECTIONS.punchItems, id);
  const snap = await getDoc(ref);
  return snap.exists() ? mapPunchItem(snap as Snap) : null;
}

/**
 * Applies a contractor's update to a punch item (Sprint 3): saves their note,
 * sets the status (In Progress or Resolved), and writes an activity log entry.
 * Used by the tokenized contractor action link flow.
 */
export async function applyContractorPunchUpdate(
  id: string,
  status: Extract<PunchItemStatus, "In Progress" | "Resolved">,
  note?: string | null,
): Promise<PunchItem> {
  const ref = doc(getDb(), COLLECTIONS.punchItems, id);
  await updateDoc(ref, {
    status,
    contractor_notes: note?.trim() ? note.trim() : null,
    resolved_at: status === "Resolved" ? serverTimestamp() : null,
    updated_at: serverTimestamp(),
  });
  const item = mapPunchItem((await getDoc(ref)) as Snap);
  await logActivity({
    action_type: "punch_item_updated",
    entity_type: "punch_item",
    entity_id: item.id,
    project_id: item.project_id,
    description: `Contractor marked punch item ${status}: ${item.title}`,
  });
  return item;
}

// ---------------------------------------------------------------------------
// Notifications
//
// Sprint 2 does not send real SMS/email/push. We record what *would* be sent
// so the workflow can be built and demoed. The records are visible on the
// /notifications screen for development and testing.
// ---------------------------------------------------------------------------

function mapNotification(s: Snap): Notification {
  const d = s.data();
  return {
    id: s.id,
    recipient_id: d.recipient_id ?? null,
    notification_type: d.notification_type as NotificationType,
    related_entity_type: d.related_entity_type,
    related_entity_id: d.related_entity_id,
    message: d.message,
    status: (d.status ?? "unread") as NotificationStatus,
    action_link_token: d.action_link_token ?? null,
    email_status: (d.email_status ?? null) as NotificationDeliveryStatus | null,
    created_at: toIso(d.created_at),
  };
}

export interface NewNotificationInput {
  recipient_id?: string | null;
  notification_type: NotificationType;
  related_entity_type: string;
  related_entity_id: string;
  message: string;
  action_link_token?: string | null;
  email_status?: NotificationDeliveryStatus | null;
}

export async function createNotification(
  input: NewNotificationInput,
): Promise<Notification> {
  const ref = await addDoc(collection(getDb(), COLLECTIONS.notifications), {
    recipient_id: input.recipient_id ?? null,
    notification_type: input.notification_type,
    related_entity_type: input.related_entity_type,
    related_entity_id: input.related_entity_id,
    message: input.message,
    status: "unread" as NotificationStatus,
    action_link_token: input.action_link_token ?? null,
    email_status: input.email_status ?? null,
    created_at: serverTimestamp(),
  });
  return mapNotification((await getDoc(ref)) as Snap);
}

/** Lists all notification records, newest first. */
export async function listNotifications(): Promise<Notification[]> {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.notifications));
  return snap.docs
    .map(mapNotification)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(getDb(), COLLECTIONS.notifications, id), {
    status: "read" as NotificationStatus,
  });
}

// ---------------------------------------------------------------------------
// Documents (Sprint 3 — Document Vault)
//
// A document record stores the metadata for a file kept in Firebase Storage.
// The upload helper (which writes to Storage) lives below; these functions read
// and map the Firestore side. Documents always belong to a project and may
// optionally link to a trade, phase, contractor, or punch item.
// ---------------------------------------------------------------------------

function mapDocument(s: Snap): ProjectDocument {
  const d = s.data();
  return {
    id: s.id,
    name: d.name,
    document_type: d.document_type as DocumentType,
    project_id: d.project_id,
    trade_id: d.trade_id ?? null,
    trade_phase_id: d.trade_phase_id ?? null,
    contractor_id: d.contractor_id ?? null,
    punch_item_id: d.punch_item_id ?? null,
    file_url: d.file_url,
    storage_path: d.storage_path,
    uploaded_by: d.uploaded_by ?? null,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    pinned: Boolean(d.pinned),
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at),
  };
}

export interface DocumentFilters {
  projectId?: string;
  tradeId?: string;
  tradePhaseId?: string;
  contractorId?: string;
  punchItemId?: string;
  documentType?: DocumentType;
  pinnedOnly?: boolean;
}

/** Lists document records (newest first) with optional in-memory filters. */
export async function listDocuments(
  filters: DocumentFilters = {},
): Promise<ProjectDocument[]> {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.documents));
  let docs = snap.docs
    .map(mapDocument)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  if (filters.projectId)
    docs = docs.filter((d) => d.project_id === filters.projectId);
  if (filters.tradeId)
    docs = docs.filter((d) => d.trade_id === filters.tradeId);
  if (filters.tradePhaseId)
    docs = docs.filter((d) => d.trade_phase_id === filters.tradePhaseId);
  if (filters.contractorId)
    docs = docs.filter((d) => d.contractor_id === filters.contractorId);
  if (filters.punchItemId)
    docs = docs.filter((d) => d.punch_item_id === filters.punchItemId);
  if (filters.documentType)
    docs = docs.filter((d) => d.document_type === filters.documentType);
  if (filters.pinnedOnly) docs = docs.filter((d) => d.pinned);

  return docs;
}

/** Loads a single document record by id, or null if it doesn't exist. */
export async function getDocument(
  id: string,
): Promise<ProjectDocument | null> {
  const ref = doc(getDb(), COLLECTIONS.documents, id);
  const snap = await getDoc(ref);
  return snap.exists() ? mapDocument(snap as Snap) : null;
}

/**
 * Uploads a document file to Firebase Storage under
 * `documents/{projectId}/` and returns the download URL plus the storage path.
 *
 * Uses a resumable upload so the caller can show real upload progress. The
 * optional `onProgress` callback receives a 0–100 percentage. Errors (network,
 * permission, size) reject the returned promise so the form can show them.
 */
export function uploadProjectDocumentFile(
  projectId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ file_url: string; storage_path: string }> {
  const storage_path = buildDocumentStoragePath(projectId, file.name);
  const r = storageRef(getFirebaseStorage(), storage_path);
  const task = uploadBytesResumable(r, file, { contentType: file.type });

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const percent = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          );
          onProgress(percent);
        }
      },
      (error) => reject(error),
      async () => {
        try {
          const file_url = await getDownloadURL(task.snapshot.ref);
          resolve({ file_url, storage_path });
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}

export interface NewDocumentInput {
  name: string;
  document_type: DocumentType;
  project_id: string;
  trade_id?: string | null;
  trade_phase_id?: string | null;
  contractor_id?: string | null;
  punch_item_id?: string | null;
  file_url: string;
  storage_path: string;
  tags?: string[];
  pinned?: boolean;
}

/**
 * Saves a document's metadata to Firestore after its file has been uploaded to
 * Storage (see uploadProjectDocumentFile). Also writes an activity log entry.
 */
export async function createDocument(
  input: NewDocumentInput,
): Promise<ProjectDocument> {
  const ref = await addDoc(collection(getDb(), COLLECTIONS.documents), {
    name: input.name,
    document_type: input.document_type,
    project_id: input.project_id,
    trade_id: input.trade_id ?? null,
    trade_phase_id: input.trade_phase_id ?? null,
    contractor_id: input.contractor_id ?? null,
    punch_item_id: input.punch_item_id ?? null,
    file_url: input.file_url,
    storage_path: input.storage_path,
    uploaded_by: uid(),
    tags: input.tags ?? [],
    pinned: input.pinned ?? false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  const document = mapDocument((await getDoc(ref)) as Snap);
  await logActivity({
    action_type: "document_uploaded",
    entity_type: "document",
    entity_id: document.id,
    project_id: document.project_id,
    description: `Document uploaded: ${document.name}`,
  });
  return document;
}

/**
 * Pins or unpins a document. Updates Firestore and writes an activity log entry
 * (document_pinned / document_unpinned) so the change shows in the feed.
 */
export async function setDocumentPinned(
  id: string,
  pinned: boolean,
): Promise<ProjectDocument> {
  const ref = doc(getDb(), COLLECTIONS.documents, id);
  await updateDoc(ref, { pinned, updated_at: serverTimestamp() });
  const document = mapDocument((await getDoc(ref)) as Snap);
  await logActivity({
    action_type: pinned ? "document_pinned" : "document_unpinned",
    entity_type: "document",
    entity_id: document.id,
    project_id: document.project_id,
    description: `${pinned ? "Pinned" : "Unpinned"} document: ${document.name}`,
  });
  return document;
}

// ---------------------------------------------------------------------------
// Contractor action links (Sprint 3)
// ---------------------------------------------------------------------------

function mapActionLink(s: Snap): ContractorActionLink {
  const data = s.data();
  return {
    id: s.id,
    token: (data.token as string) ?? s.id,
    action_type: data.action_type as ActionLinkType,
    related_entity_type: data.related_entity_type as ActionLinkEntityType,
    related_entity_id: data.related_entity_id as string,
    contractor_id: data.contractor_id as string,
    project_id: data.project_id as string,
    expiration_date: (data.expiration_date as string | null) ?? null,
    used_at: (data.used_at as string | null) ?? null,
    status: data.status as ActionLinkStatus,
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
  };
}

export interface NewActionLinkInput {
  action_type: ActionLinkType;
  related_entity_id: string;
  contractor_id: string;
  project_id: string;
  /** Optional explicit entity type; inferred from action_type when omitted. */
  related_entity_type?: ActionLinkEntityType;
  /** Optional explicit ISO expiry; defaults to the standard TTL when omitted. */
  expiration_date?: string | null;
}

/**
 * Creates a contractor action link. The unguessable token is also used as the
 * Firestore document id, so the link can only be opened by someone who has the
 * token (the collection is never listed publicly).
 */
export async function createActionLink(
  input: NewActionLinkInput,
): Promise<ContractorActionLink> {
  const token = generateActionToken();
  const ref = doc(getDb(), COLLECTIONS.contractorActionLinks, token);
  await setDoc(ref, {
    token,
    action_type: input.action_type,
    related_entity_type:
      input.related_entity_type ?? entityTypeForAction(input.action_type),
    related_entity_id: input.related_entity_id,
    contractor_id: input.contractor_id,
    project_id: input.project_id,
    expiration_date:
      input.expiration_date === undefined
        ? defaultExpiration()
        : input.expiration_date,
    used_at: null,
    status: "Active" as ActionLinkStatus,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return mapActionLink((await getDoc(ref)) as Snap);
}

/** Loads a link by its token (document id), or null if it doesn't exist. */
export async function getActionLinkByToken(
  token: string,
): Promise<ContractorActionLink | null> {
  const ref = doc(getDb(), COLLECTIONS.contractorActionLinks, token);
  const snap = await getDoc(ref);
  return snap.exists() ? mapActionLink(snap as Snap) : null;
}

export interface ActionLinkFilters {
  projectId?: string;
  contractorId?: string;
  relatedEntityId?: string;
  actionType?: ActionLinkType;
  status?: ActionLinkStatus;
}

/** Lists action links (GC side), newest first, with optional filters. */
export async function listActionLinks(
  filters: ActionLinkFilters = {},
): Promise<ContractorActionLink[]> {
  const snap = await getDocs(
    collection(getDb(), COLLECTIONS.contractorActionLinks),
  );
  let links = snap.docs.map((d) => mapActionLink(d as Snap));
  if (filters.projectId)
    links = links.filter((l) => l.project_id === filters.projectId);
  if (filters.contractorId)
    links = links.filter((l) => l.contractor_id === filters.contractorId);
  if (filters.relatedEntityId)
    links = links.filter((l) => l.related_entity_id === filters.relatedEntityId);
  if (filters.actionType)
    links = links.filter((l) => l.action_type === filters.actionType);
  if (filters.status) links = links.filter((l) => l.status === filters.status);
  return links.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** Marks a link as used (one-time actions). */
export async function markActionLinkUsed(
  token: string,
): Promise<ContractorActionLink> {
  const ref = doc(getDb(), COLLECTIONS.contractorActionLinks, token);
  await updateDoc(ref, {
    status: "Used" as ActionLinkStatus,
    used_at: new Date().toISOString(),
    updated_at: serverTimestamp(),
  });
  return mapActionLink((await getDoc(ref)) as Snap);
}

/** Revokes a link so it can no longer be used. */
export async function revokeActionLink(
  token: string,
): Promise<ContractorActionLink> {
  const ref = doc(getDb(), COLLECTIONS.contractorActionLinks, token);
  await updateDoc(ref, {
    status: "Revoked" as ActionLinkStatus,
    updated_at: serverTimestamp(),
  });
  return mapActionLink((await getDoc(ref)) as Snap);
}

/**
 * Creates a Schedule Confirmation action link for a trade phase's contractor
 * and logs that the request was sent (Sprint 3). Notification delivery is
 * handled by the caller via the notification service.
 */
export async function requestScheduleConfirmation(input: {
  phaseId: string;
  projectId: string;
  contractorId: string;
  phaseTitle?: string;
}): Promise<ContractorActionLink> {
  const link = await createActionLink({
    action_type: "Schedule Confirmation",
    related_entity_id: input.phaseId,
    contractor_id: input.contractorId,
    project_id: input.projectId,
  });
  await logActivity({
    action_type: "schedule_confirmation_requested",
    entity_type: "trade_phase",
    entity_id: input.phaseId,
    project_id: input.projectId,
    description: `Schedule confirmation requested${
      input.phaseTitle ? ` for ${input.phaseTitle}` : ""
    }`,
  });
  return link;
}

/**
 * Records a contractor's schedule confirmation decision on a trade phase
 * (Sprint 3). Confirming or declining updates the phase's confirmation status
 * (and note, for declines) and writes an activity log entry.
 */
export async function setPhaseScheduleConfirmation(
  phaseId: string,
  decision: Exclude<ScheduleConfirmationStatus, "Pending">,
  note?: string | null,
): Promise<TradePhase> {
  const ref = doc(getDb(), COLLECTIONS.tradePhases, phaseId);
  await updateDoc(ref, {
    schedule_confirmation_status: decision,
    schedule_confirmation_note: decision === "Declined" ? note ?? null : null,
    updated_at: serverTimestamp(),
  });
  const phase = mapPhase((await getDoc(ref)) as Snap);
  await logActivity({
    action_type: decision === "Confirmed" ? "schedule_confirmed" : "schedule_declined",
    entity_type: "trade_phase",
    entity_id: phase.id,
    project_id: phase.project_id,
    description:
      decision === "Confirmed"
        ? `Contractor confirmed the schedule for ${phase.title}`
        : `Contractor declined the schedule for ${phase.title}${
            note ? `: ${note}` : ""
          }`,
  });
  return phase;
}
