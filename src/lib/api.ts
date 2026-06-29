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
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDb, getFirebaseAuth, getFirebaseStorage } from "@/lib/firebase/client";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import type {
  ActivityAction,
  ActivityLog,
  CompletionRecord,
  CompletionStatus,
  Contractor,
  Inspection,
  InspectionResult,
  MaterialOrder,
  MaterialOrderStatus,
  Project,
  PunchItem,
  PunchItemStatus,
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
  materialOrders: "materialOrders",
  completionRecords: "completionRecords",
  inspections: "inspections",
  punchItems: "punchItems",
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
    description: d.description,
    status: d.status as PunchItemStatus,
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

export interface NewPunchItemInput {
  trade_phase_id: string;
  project_id: string;
  description: string;
}

export async function createPunchItem(
  input: NewPunchItemInput,
): Promise<PunchItem> {
  const ref = await addDoc(collection(getDb(), COLLECTIONS.punchItems), {
    trade_phase_id: input.trade_phase_id,
    project_id: input.project_id,
    description: input.description,
    status: "Open" as PunchItemStatus,
    resolved_at: null,
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
    description: `Punch item added: ${item.description}`,
  });
  return item;
}

export async function updatePunchItemStatus(
  id: string,
  status: PunchItemStatus,
): Promise<PunchItem> {
  const ref = doc(getDb(), COLLECTIONS.punchItems, id);
  await updateDoc(ref, {
    status,
    resolved_at: status === "Resolved" ? serverTimestamp() : null,
    updated_at: serverTimestamp(),
  });
  const item = mapPunchItem((await getDoc(ref)) as Snap);
  if (status === "Resolved") {
    await logActivity({
      action_type: "punch_item_resolved",
      entity_type: "punch_item",
      entity_id: item.id,
      project_id: item.project_id,
      description: `Punch item resolved: ${item.description}`,
    });
  }
  return item;
}
