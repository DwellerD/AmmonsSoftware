import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as queryLimit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
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
  MATERIAL_RECEIPT_MAX_FILE_BYTES,
  MATERIAL_RECEIPT_MAX_PHOTOS,
} from "@/lib/constants";
import {
  defaultExpiration,
  entityTypeForAction,
  generateActionToken,
  isActionLinkExpired,
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
  MaterialReceiptUpload,
  Notification,
  NotificationDeliveryStatus,
  NotificationStatus,
  NotificationType,
  Project,
  ProjectAccess,
  ProjectInvite,
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
import {
  fullProjectPermissions,
  hasProjectViewAccess,
  permissionStateFromFields,
  type ProjectPermissionField,
  type ProjectPermissionState,
} from "@/lib/projectSharing";

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
  projectAccess: "projectAccess",
  projectInvites: "projectInvites",
  contractors: "contractors",
  trades: "trades",
  tradePhases: "tradePhases",
  activityLogs: "activityLogs",
  materialOrders: "materialOrders",
  materialReceiptUploads: "materialReceiptUploads",
  completionRecords: "completionRecords",
  inspections: "inspections",
  punchItems: "punchItems",
  notifications: "notifications",
  documents: "documents",
  contractorActionLinks: "contractorActionLinks",
} as const;

const QUERY_COLLECTION_READ_LIMIT = 250;
const ACTIVITY_READ_LIMIT = 1000;
const DEDUPE_SCAN_LIMIT = 100;
const NOTIFICATION_DEDUPE_WINDOW_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

type Snap = QueryDocumentSnapshot<DocumentData>;

function accessDocId(projectId: string, userId: string): string {
  return `${projectId}_${userId}`;
}

function inviteDocId(token: string): string {
  return token;
}

function projectPermissionState(data: Record<string, unknown>): ProjectPermissionState {
  return permissionStateFromFields({
    can_view_project: Boolean(data.can_view_project),
    can_edit_project: Boolean(data.can_edit_project),
    can_view_trades: Boolean(data.can_view_trades),
    can_edit_trades: Boolean(data.can_edit_trades),
    can_view_trade_phases: Boolean(data.can_view_trade_phases),
    can_edit_trade_phases: Boolean(data.can_edit_trade_phases),
    can_view_material_orders: Boolean(data.can_view_material_orders),
    can_edit_material_orders: Boolean(data.can_edit_material_orders),
    can_view_punch_items: Boolean(data.can_view_punch_items),
    can_edit_punch_items: Boolean(data.can_edit_punch_items),
    can_view_documents: Boolean(data.can_view_documents),
    can_edit_documents: Boolean(data.can_edit_documents),
    can_view_activity: Boolean(data.can_view_activity),
    can_edit_activity: Boolean(data.can_edit_activity),
    can_manage_members: Boolean(data.can_manage_members),
  });
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function isPermissionDeniedError(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code?: unknown }).code
      : undefined;
  if (code === "permission-denied") return true;
  const message = formatError(err).toLowerCase();
  return (
    message.includes("permission-denied") ||
    message.includes("missing or insufficient permissions")
  );
}

function mapProjectAccess(s: Snap): ProjectAccess {
  const d = s.data();
  return {
    id: s.id,
    project_id: d.project_id,
    user_id: d.user_id,
    email: d.email ?? null,
    ...projectPermissionState(d),
    invite_token: d.invite_token ?? null,
    created_by: d.created_by ?? null,
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at),
  };
}

function mapProjectInvite(s: Snap): ProjectInvite {
  const d = s.data();
  return {
    id: s.id,
    token: d.token ?? s.id,
    project_id: d.project_id,
    project_name: d.project_name,
    invited_email: d.invited_email,
    message: d.message ?? null,
    ...projectPermissionState(d),
    status: (d.status ?? "Pending") as ProjectInvite["status"],
    invited_by: d.invited_by ?? null,
    invited_by_email: d.invited_by_email ?? null,
    accepted_by: d.accepted_by ?? null,
    accepted_at: d.accepted_at ? toIso(d.accepted_at) : null,
    expires_at: d.expires_at ? toIso(d.expires_at) : null,
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at),
  };
}

async function getProjectOwnerId(projectId: string): Promise<string | null> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.projects, projectId));
  if (!snap.exists()) return null;
  return (snap.data().created_by as string | null) ?? null;
}

async function getCurrentUserProjectAccess(
  projectId: string,
): Promise<ProjectAccess | null> {
  const userId = uid();
  if (!userId) return null;

  const ownerId = await getProjectOwnerId(projectId);
  if (ownerId === userId) {
    return {
      id: accessDocId(projectId, userId),
      project_id: projectId,
      user_id: userId,
      email: getFirebaseAuth().currentUser?.email ?? null,
      ...fullProjectPermissions(),
      invite_token: null,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const ref = doc(getDb(), COLLECTIONS.projectAccess, accessDocId(projectId, userId));
  const snap = await getDoc(ref);
  if (snap.exists()) return mapProjectAccess(snap as Snap);

  return null;
}

export async function getMyProjectAccess(
  projectId: string,
): Promise<ProjectAccess | null> {
  return getCurrentUserProjectAccess(projectId);
}

async function requireProjectPermission(
  projectId: string,
  field: ProjectPermissionField,
): Promise<ProjectAccess> {
  const access = await getCurrentUserProjectAccess(projectId);
  if (!access || !access[field]) {
    throw new Error("You do not have permission to access this project.");
  }
  return access;
}

async function getCurrentUserProjectAccessMap(): Promise<Map<string, ProjectAccess>> {
  const userId = requireUid();
  const db = getDb();
  const accessRes = await getDocs(
    query(collection(db, COLLECTIONS.projectAccess), where("user_id", "==", userId)),
  ).catch((err) => {
    console.warn("Project access query failed; continuing without it.", err);
    return null;
  });
  const ownedRes = await getDocs(
    query(
      collection(db, COLLECTIONS.projects),
      where("created_by", "==", userId),
    ),
  ).catch((err) => {
    console.warn("Owned projects query failed; continuing without it.", err);
    return null;
  });

  const accessMap = new Map<string, ProjectAccess>();

  accessRes?.docs.forEach((snap) => {
    const access = mapProjectAccess(snap as Snap);
    accessMap.set(access.project_id, access);
  });

  ownedRes?.docs.forEach((snap) => {
    const projectId = snap.id;
    accessMap.set(projectId, {
      id: accessDocId(projectId, userId),
      project_id: projectId,
      user_id: userId,
      email: getFirebaseAuth().currentUser?.email ?? null,
      ...fullProjectPermissions(),
      invite_token: null,
      created_by: userId,
      created_at: toIso(snap.data().created_at),
      updated_at: toIso(snap.data().updated_at),
    });
  });

  return accessMap;
}

async function getProjectIdsWithSectionAccess(
  field: ProjectPermissionField,
): Promise<Set<string>> {
  const accessMap = await getCurrentUserProjectAccessMap();
  const ids = new Set<string>();
  accessMap.forEach((access, projectId) => {
    if (hasProjectViewAccess(access) && field === "can_view_project") {
      ids.add(projectId);
      return;
    }
    if (access[field]) ids.add(projectId);
  });
  return ids;
}

function normalizeInvitePermissions(
  input: Partial<ProjectPermissionState>,
): ProjectPermissionState {
  return permissionStateFromFields({
    can_view_project: input.can_view_project,
    can_edit_project: input.can_edit_project,
    can_view_trades: input.can_view_trades,
    can_edit_trades: input.can_edit_trades,
    can_view_trade_phases: input.can_view_trade_phases,
    can_edit_trade_phases: input.can_edit_trade_phases,
    can_view_material_orders: input.can_view_material_orders,
    can_edit_material_orders: input.can_edit_material_orders,
    can_view_punch_items: input.can_view_punch_items,
    can_edit_punch_items: input.can_edit_punch_items,
    can_view_documents: input.can_view_documents,
    can_edit_documents: input.can_edit_documents,
    can_view_activity: input.can_view_activity,
    can_edit_activity: input.can_edit_activity,
    can_manage_members: input.can_manage_members,
  });
}

function chunkProjectIds(projectIds: Set<string>): string[][] {
  const ids = [...projectIds];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) {
    chunks.push(ids.slice(i, i + 10));
  }
  return chunks;
}

async function loadDocsByVisibleProjects(
  collectionName: string,
  projectIds: Set<string>,
  maxDocs = QUERY_COLLECTION_READ_LIMIT,
): Promise<Snap[]> {
  if (projectIds.size === 0) return [];
  const chunks = chunkProjectIds(projectIds);
  const perChunkLimit = Math.max(1, Math.ceil(maxDocs / chunks.length));
  const snaps = await Promise.all(
    chunks.map((ids) =>
      getDocs(
        query(
          collection(getDb(), collectionName),
          where("project_id", "in", ids),
          queryLimit(perChunkLimit),
        ),
      ),
    ),
  );
  return snaps.flatMap((snap) => snap.docs as Snap[]);
}

/** Current signed-in user's id, used to stamp created_by / user_id. */
function uid(): string | null {
  return getFirebaseAuth().currentUser?.uid ?? null;
}

function requireUid(): string {
  const id = uid();
  if (!id) throw new Error("You must be signed in.");
  return id;
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
  const accessibleIds = await getProjectIdsWithSectionAccess("can_view_project");
  if (accessibleIds.size === 0) return [];
  const cappedIds = [...accessibleIds].slice(0, QUERY_COLLECTION_READ_LIMIT);

  const snaps = await Promise.all(
    cappedIds.map((projectId) =>
      getDoc(doc(getDb(), COLLECTIONS.projects, projectId)),
    ),
  );
  const projects = snaps
    .filter((snap): snap is Snap => snap.exists())
    .map((snap) => mapProject(snap))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return projects;
}

export async function getProject(id: string): Promise<Project | null> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.projects, id));
  if (!snap.exists()) return null;
  const project = mapProject(snap as Snap);
  const access = await getCurrentUserProjectAccess(id);
  return access && hasProjectViewAccess(access) ? project : null;
}

export interface NewProjectInput {
  name: string;
  location?: string;
  start_date?: string;
  estimated_end_date?: string;
  notes?: string;
}

export async function createProject(input: NewProjectInput): Promise<Project> {
  const auth = getFirebaseAuth();
  if ("authStateReady" in auth && typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  }
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  const ref = await addDoc(collection(getDb(), COLLECTIONS.projects), {
    name: input.name,
    location: input.location || null,
    start_date: input.start_date || null,
    estimated_end_date: input.estimated_end_date || null,
    notes: input.notes || null,
    created_by: userId,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  const project = mapProject((await getDoc(ref)) as Snap);
  await setDoc(doc(getDb(), COLLECTIONS.projectAccess, accessDocId(project.id, userId)), {
    project_id: project.id,
    user_id: userId,
    email: auth.currentUser?.email ?? null,
    ...fullProjectPermissions(),
    invite_token: null,
    created_by: userId,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  await logActivity({
    action_type: "project_created",
    entity_type: "project",
    entity_id: project.id,
    project_id: project.id,
    description: `Project "${project.name}" was created`,
  });
  return project;
}

export async function listProjectMembers(projectId: string): Promise<ProjectAccess[]> {
  const access = await getCurrentUserProjectAccess(projectId);
  if (!access || !access.can_manage_members) {
    throw new Error("You do not have permission to manage users for this project.");
  }

  const db = getDb();
  const [projectSnap, memberSnap] = await Promise.all([
    getDoc(doc(db, COLLECTIONS.projects, projectId)),
    getDocs(query(collection(db, COLLECTIONS.projectAccess), where("project_id", "==", projectId))),
  ]);

  const members: ProjectAccess[] = [];
  if (projectSnap.exists()) {
    const ownerId = projectSnap.data().created_by as string | null;
    if (ownerId) {
      members.push({
        id: accessDocId(projectId, ownerId),
        project_id: projectId,
        user_id: ownerId,
        email: ownerId === uid() ? getFirebaseAuth().currentUser?.email ?? null : null,
        ...fullProjectPermissions(),
        invite_token: null,
        created_by: ownerId,
        created_at: toIso(projectSnap.data().created_at),
        updated_at: toIso(projectSnap.data().updated_at),
      });
    }
  }

  memberSnap.docs.forEach((snap) => {
    members.push(mapProjectAccess(snap as Snap));
  });

  const seen = new Set<string>();
  return members.filter((member) => {
    const key = member.user_id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface UpdateProjectAccessInput extends ProjectPermissionState {
  email?: string | null;
}

export async function updateProjectAccess(
  projectId: string,
  userId: string,
  input: UpdateProjectAccessInput,
): Promise<ProjectAccess> {
  const current = await requireProjectPermission(projectId, "can_manage_members");
  const ref = doc(getDb(), COLLECTIONS.projectAccess, accessDocId(projectId, userId));
  const next = {
    project_id: projectId,
    user_id: userId,
    email: input.email ?? null,
    ...permissionStateFromFields(input),
    invite_token: null,
    created_by: current.user_id,
    updated_at: serverTimestamp(),
  };
  const existing = await getDoc(ref);
  await setDoc(ref, {
    ...next,
    created_at: existing.exists() ? existing.data().created_at : serverTimestamp(),
  }, { merge: true });
  return mapProjectAccess((await getDoc(ref)) as Snap);
}

export async function removeProjectAccess(
  projectId: string,
  userId: string,
): Promise<void> {
  await requireProjectPermission(projectId, "can_manage_members");
  if (uid() === userId) {
    throw new Error("You cannot remove your own project access.");
  }
  await deleteDoc(doc(getDb(), COLLECTIONS.projectAccess, accessDocId(projectId, userId)));
}

export interface NewProjectInviteInput {
  project_id: string;
  project_name: string;
  invited_email: string;
  message?: string | null;
  permissions?: Partial<ProjectPermissionState>;
}

export async function createProjectInvite(
  input: NewProjectInviteInput,
): Promise<ProjectInvite> {
  await requireProjectPermission(input.project_id, "can_manage_members");
  const invitedEmail = input.invited_email.trim().toLowerCase();
  const permissions = normalizeInvitePermissions(input.permissions ?? {});
  const inviteMessage = input.message?.trim() ? input.message.trim() : null;

  const existingInvites = await getDocs(
    query(
      collection(getDb(), COLLECTIONS.projectInvites),
      where("project_id", "==", input.project_id),
      queryLimit(DEDUPE_SCAN_LIMIT),
    ),
  );
  const pendingExisting = existingInvites.docs.find((snap) => {
    const data = snap.data();
    return (
      (data.invited_email as string | null)?.toLowerCase() === invitedEmail &&
      data.status === "Pending"
    );
  });

  if (pendingExisting) {
    await updateDoc(pendingExisting.ref, {
      project_name: input.project_name,
      message: inviteMessage,
      ...permissions,
      expires_at: Timestamp.fromDate(new Date(defaultExpiration(14))),
      updated_at: serverTimestamp(),
    });
    return mapProjectInvite((await getDoc(pendingExisting.ref)) as Snap);
  }

  const token = generateActionToken();
  const ref = doc(getDb(), COLLECTIONS.projectInvites, inviteDocId(token));
  await setDoc(ref, {
    token,
    project_id: input.project_id,
    project_name: input.project_name,
    invited_email: invitedEmail,
    message: inviteMessage,
    ...permissions,
    status: "Pending",
    invited_by: uid(),
    invited_by_email: getFirebaseAuth().currentUser?.email ?? null,
    accepted_by: null,
    accepted_at: null,
    expires_at: Timestamp.fromDate(new Date(defaultExpiration(14))),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return mapProjectInvite((await getDoc(ref)) as Snap);
}

export async function listProjectInvites(projectId: string): Promise<ProjectInvite[]> {
  await requireProjectPermission(projectId, "can_manage_members");
  const snap = await getDocs(
    query(collection(getDb(), COLLECTIONS.projectInvites), where("project_id", "==", projectId)),
  );
  return snap.docs.map((s) => mapProjectInvite(s as Snap)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function getProjectInviteByToken(token: string): Promise<ProjectInvite | null> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.projectInvites, inviteDocId(token)));
  return snap.exists() ? mapProjectInvite(snap as Snap) : null;
}

function ensureInviteIsPending(invite: ProjectInvite): void {
  if (invite.status !== "Pending") {
    throw new Error(`This invite is already ${invite.status.toLowerCase()}.`);
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    throw new Error("This invite has expired.");
  }
}

export async function revokeProjectInvite(token: string): Promise<ProjectInvite> {
  const invite = await getProjectInviteByToken(token);
  if (!invite) throw new Error("Invite not found.");
  if (invite.status !== "Pending") {
    throw new Error("Only pending invites can be revoked.");
  }
  await requireProjectPermission(invite.project_id, "can_manage_members");
  const ref = doc(getDb(), COLLECTIONS.projectInvites, inviteDocId(token));
  await updateDoc(ref, { status: "Revoked", updated_at: serverTimestamp() });
  return mapProjectInvite((await getDoc(ref)) as Snap);
}

export async function revokeProjectInvitesForEmail(
  projectId: string,
  email: string,
): Promise<void> {
  await requireProjectPermission(projectId, "can_manage_members");
  const normalizedEmail = email.trim().toLowerCase();
  const snap = await getDocs(
    query(
      collection(getDb(), COLLECTIONS.projectInvites),
      where("project_id", "==", projectId),
    ),
  );

  const revokeOps = snap.docs
    .filter((docSnap) => {
      const data = docSnap.data();
      return (
        (data.invited_email as string | null)?.toLowerCase() === normalizedEmail &&
        data.status === "Pending"
      );
    })
    .map((docSnap) =>
      updateDoc(docSnap.ref, {
        status: "Revoked",
        updated_at: serverTimestamp(),
      }),
    );

  await Promise.all(revokeOps);
}

export async function acceptProjectInvite(token: string): Promise<ProjectAccess> {
  const invite = await getProjectInviteByToken(token);
  if (!invite) throw new Error("Invite not found.");
  ensureInviteIsPending(invite);
  const auth = getFirebaseAuth().currentUser;
  if (!auth) throw new Error("You must be signed in to accept an invite.");
  if ((auth.email ?? "").toLowerCase() !== invite.invited_email.toLowerCase()) {
    throw new Error("That invite was sent to a different email address.");
  }

  const accessRef = doc(getDb(), COLLECTIONS.projectAccess, accessDocId(invite.project_id, auth.uid));
  await setDoc(accessRef, {
    project_id: invite.project_id,
    user_id: auth.uid,
    email: auth.email ?? null,
    invite_token: token,
    ...permissionStateFromFields(invite),
    created_by: invite.invited_by,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  }, { merge: true });

  const inviteRef = doc(getDb(), COLLECTIONS.projectInvites, inviteDocId(token));
  await updateDoc(inviteRef, {
    status: "Accepted",
    accepted_by: auth.uid,
    accepted_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  return mapProjectAccess((await getDoc(accessRef)) as Snap);
}

export async function rejectProjectInvite(token: string): Promise<ProjectInvite> {
  const invite = await getProjectInviteByToken(token);
  if (!invite) throw new Error("Invite not found.");
  ensureInviteIsPending(invite);

  const auth = getFirebaseAuth().currentUser;
  if (!auth) throw new Error("You must be signed in to reject an invite.");
  if ((auth.email ?? "").toLowerCase() !== invite.invited_email.toLowerCase()) {
    throw new Error("That invite was sent to a different email address.");
  }

  const ref = doc(getDb(), COLLECTIONS.projectInvites, inviteDocId(token));
  await updateDoc(ref, {
    status: "Rejected",
    updated_at: serverTimestamp(),
  });

  return mapProjectInvite((await getDoc(ref)) as Snap);
}

// ---------------------------------------------------------------------------
// Contractors
// ---------------------------------------------------------------------------

export async function listContractors(): Promise<Contractor[]> {
  const userId = requireUid();
  const snap = await getDocs(
    query(
      collection(getDb(), COLLECTIONS.contractors),
      where("created_by", "==", userId),
    ),
  );
  return snap.docs
    .map(mapContractor)
    .sort((a, b) => a.company_name.localeCompare(b.company_name));
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
  const visibleProjectIds = projectId
    ? new Set([projectId])
    : await getProjectIdsWithSectionAccess("can_view_trades");
  // Load trades and contractors, then join in memory.
  const [tradeSnap, contractors] = await Promise.all([
    loadDocsByVisibleProjects(COLLECTIONS.trades, visibleProjectIds),
    listContractors(),
  ]);
  const contractorById = new Map(contractors.map((c) => [c.id, c]));
  const trades = tradeSnap
    .map(mapTrade)
    .sort((a, b) => a.name.localeCompare(b.name));

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
  await requireProjectPermission(input.project_id, "can_edit_trades");
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
  const current = await getDoc(ref);
  if (!current.exists()) {
    throw new Error("Trade not found.");
  }
  const existing = mapTrade(current as Snap);
  await requireProjectPermission(existing.project_id, "can_edit_trades");
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
  const ref = doc(getDb(), COLLECTIONS.trades, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const trade = mapTrade(snap as Snap);
  await requireProjectPermission(trade.project_id, "can_edit_trades");
  await deleteDoc(ref);
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
  const visibleProjectIds = filters.projectId
    ? new Set([filters.projectId])
    : await getProjectIdsWithSectionAccess("can_view_trade_phases");
  // Load phases plus the collections we need to resolve names, then join.
  const [phaseRes, tradeRes, contractorRes, projectRes] = await Promise.allSettled([
    loadDocsByVisibleProjects(COLLECTIONS.tradePhases, visibleProjectIds),
    loadDocsByVisibleProjects(COLLECTIONS.trades, visibleProjectIds),
    listContractors(),
    Promise.all(
      [...visibleProjectIds].map((projectId) =>
        getDoc(doc(getDb(), COLLECTIONS.projects, projectId)),
      ),
    ),
  ]);

  const failures: string[] = [];
  if (phaseRes.status === "rejected") failures.push(`phase docs: ${String(phaseRes.reason)}`);
  if (tradeRes.status === "rejected") failures.push(`trade docs: ${String(tradeRes.reason)}`);
  if (contractorRes.status === "rejected") failures.push(`contractors: ${String(contractorRes.reason)}`);
  if (projectRes.status === "rejected") failures.push(`project docs: ${String(projectRes.reason)}`);
  if (failures.length > 0) {
    throw new Error(`Trade phase load failed: ${failures.join(" | ")}`);
  }

  const phaseSnap = phaseRes.status === "fulfilled" ? phaseRes.value : [];
  const tradeSnap = tradeRes.status === "fulfilled" ? tradeRes.value : [];
  const contractorSnap =
    contractorRes.status === "fulfilled" ? contractorRes.value : [];
  const projectSnap = projectRes.status === "fulfilled" ? projectRes.value : [];

  const trades = new Map(tradeSnap.map((s) => [s.id, mapTrade(s)]));
  const contractors = new Map(contractorSnap.map((contractor) => [contractor.id, contractor]));
  const projects = new Map(
    projectSnap
      .filter((snap): snap is Snap => snap.exists())
      .map((snap) => [snap.id, mapProject(snap)]),
  );

  const today = todayIso();
  const normalizedPhases = await Promise.all(
    phaseSnap
      .map((s) => mapPhase(s))
      .filter((phase) => visibleProjectIds.has(phase.project_id))
      .map((phase) => applyAutomaticNeedsInspection(phase, today)),
  );

  let phases = normalizedPhases
    .map((phase) =>
    attachRelations(phase, trades, contractors, projects),
    )
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

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
  const snap = await getDoc(doc(db, COLLECTIONS.tradePhases, id)).catch((err) => {
    throw new Error(`Trade phase read failed (${id}): ${formatError(err)}`);
  });
  if (!snap.exists()) return null;
  const basePhase = mapPhase(snap as Snap);
  const access = await getCurrentUserProjectAccess(basePhase.project_id).catch((err) => {
    throw new Error(
      `Project access check failed (${basePhase.project_id}): ${formatError(err)}`,
    );
  });
  if (
    !access ||
    (!access.can_view_trade_phases && !access.can_edit_trade_phases)
  ) {
    return null;
  }
  const phase = await applyAutomaticNeedsInspection(basePhase, todayIso());

  const [tradeRes, contractorRes, projectRes] = await Promise.allSettled([
    getDoc(doc(db, COLLECTIONS.trades, phase.trade_id)),
    phase.contractor_id
      ? getDoc(doc(db, COLLECTIONS.contractors, phase.contractor_id))
      : Promise.resolve(null),
    getDoc(doc(db, COLLECTIONS.projects, phase.project_id)),
  ]);

  if (tradeRes.status === "rejected") {
    throw new Error(`Trade read failed (${phase.trade_id}): ${formatError(tradeRes.reason)}`);
  }
  if (projectRes.status === "rejected") {
    throw new Error(`Project read failed (${phase.project_id}): ${formatError(projectRes.reason)}`);
  }
  if (
    contractorRes.status === "rejected" &&
    !isPermissionDeniedError(contractorRes.reason)
  ) {
    throw new Error(
      `Contractor read failed (${phase.contractor_id ?? "none"}): ${formatError(contractorRes.reason)}`,
    );
  }

  const tradeDoc = tradeRes.value;
  const contractorDoc =
    contractorRes.status === "fulfilled" ? contractorRes.value : null;
  const projectDoc = projectRes.value;

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
  const visibleProjectIds = await getProjectIdsWithSectionAccess("can_view_activity");
  const snap = await loadDocsByVisibleProjects(
    COLLECTIONS.activityLogs,
    visibleProjectIds,
    ACTIVITY_READ_LIMIT,
  );
  return snap
    .map(mapActivity)
    .filter((activity) => activity.project_id && visibleProjectIds.has(activity.project_id))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
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
    receipt_upload_ids: Array.isArray(d.receipt_upload_ids)
      ? d.receipt_upload_ids
      : [],
    latest_receipt_upload_id: d.latest_receipt_upload_id ?? null,
    receipt_upload_token: d.receipt_upload_token ?? null,
    created_by: d.created_by ?? null,
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at),
  };
}

function mapMaterialReceiptUpload(s: Snap): MaterialReceiptUpload {
  const d = s.data();
  return {
    id: s.id,
    material_order_id: d.material_order_id,
    project_id: d.project_id,
    action_link_token: d.action_link_token,
    uploaded_by_name: d.uploaded_by_name ?? null,
    notes: d.notes ?? null,
    photo_urls: Array.isArray(d.photo_urls) ? d.photo_urls : [],
    storage_paths: Array.isArray(d.storage_paths) ? d.storage_paths : [],
    submitted_by: d.submitted_by ?? null,
    submitted_at: toIso(d.submitted_at),
    created_at: toIso(d.created_at),
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

/** Loads all docs in a collection for one project, oldest first. */
async function listForProject(
  collectionName: string,
  projectId: string,
): Promise<Snap[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), collectionName),
      where("project_id", "==", projectId),
      queryLimit(QUERY_COLLECTION_READ_LIMIT),
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
  const visibleProjectIds = filters.projectId
    ? new Set([filters.projectId])
    : await getProjectIdsWithSectionAccess("can_view_material_orders");
  const snap = await loadDocsByVisibleProjects(COLLECTIONS.materialOrders, visibleProjectIds);
  let orders = snap
    .map(mapMaterialOrder)
    .filter((order) => visibleProjectIds.has(order.project_id))
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
  await requireProjectPermission(input.project_id, "can_edit_material_orders");
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
    receipt_upload_ids: [],
    latest_receipt_upload_id: null,
    receipt_upload_token: null,
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
  const before = await getMaterialOrder(id).catch((err) => {
    throw new Error(`Material read failed (${id}): ${formatError(err)}`);
  });
  if (!before) throw new Error("Material order not found.");
  await requireProjectPermission(before.project_id, "can_edit_material_orders").catch((err) => {
    throw new Error(
      `Material edit check failed (${before.project_id}): ${formatError(err)}`,
    );
  });
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
  }).catch((err) => {
    throw new Error(`Material update failed (${before.project_id}): ${formatError(err)}`);
  });
  const orderSnap = await getDoc(ref).catch((err) => {
    throw new Error(`Material reload failed (${id}): ${formatError(err)}`);
  });
  const order = mapMaterialOrder(orderSnap as Snap);
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
  const ref = doc(getDb(), COLLECTIONS.materialOrders, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const order = mapMaterialOrder(snap as Snap);
  await requireProjectPermission(order.project_id, "can_edit_material_orders");
  await deleteDoc(ref);
}

export async function updateMaterialOrderStatus(
  id: string,
  status: MaterialOrderStatus,
): Promise<MaterialOrder> {
  const ref = doc(getDb(), COLLECTIONS.materialOrders, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Material order not found.");
  const before = mapMaterialOrder(snap as Snap);
  await requireProjectPermission(before.project_id, "can_edit_material_orders");
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

/** Lists receipt submissions for one material order, newest first. */
export async function listMaterialReceiptUploads(
  materialOrderId: string,
): Promise<MaterialReceiptUpload[]> {
  const order = await getMaterialOrder(materialOrderId);
  if (!order) return [];
  await requireProjectPermission(order.project_id, "can_view_material_orders");
  const receipts = await listForProject(
    COLLECTIONS.materialReceiptUploads,
    order.project_id,
  );
  return receipts
    .map(mapMaterialReceiptUpload)
    .filter((receipt) => receipt.material_order_id === materialOrderId)
    .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
}

/** Creates or reuses a one-time receipt-photo upload link for an order. */
export async function createMaterialReceiptUploadLink(
  materialOrderId: string,
): Promise<ContractorActionLink> {
  const order = await getMaterialOrder(materialOrderId);
  if (!order) throw new Error("Material order not found.");
  await requireProjectPermission(order.project_id, "can_edit_material_orders");

  const existing = await listActionLinks({
    projectId: order.project_id,
    relatedEntityId: order.id,
    actionType: "Material Receipt Upload",
    status: "Active",
  });
  if (existing[0] && !isActionLinkExpired(existing[0])) return existing[0];

  const project = await getProject(order.project_id);
  const token = generateActionToken();
  const expirationDate = defaultExpiration();
  const linkRef = doc(getDb(), COLLECTIONS.contractorActionLinks, token);
  const orderRef = doc(getDb(), COLLECTIONS.materialOrders, order.id);
  const batch = writeBatch(getDb());
  batch.set(linkRef, {
    created_by: requireUid(),
    token,
    action_type: "Material Receipt Upload" as ActionLinkType,
    related_entity_type: "material_order" as ActionLinkEntityType,
    related_entity_id: order.id,
    contractor_id: null,
    project_id: order.project_id,
    material_name: order.name,
    supplier_name: order.supplier,
    expected_arrival_date: order.expected_arrival_date,
    project_name: project?.name ?? null,
    expiration_date: expirationDate,
    expiration_at: Timestamp.fromDate(new Date(expirationDate)),
    used_at: null,
    status: "Active" as ActionLinkStatus,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  batch.update(orderRef, {
    receipt_upload_token: token,
    updated_at: serverTimestamp(),
  });
  await batch.commit();
  return mapActionLink((await getDoc(linkRef)) as Snap);
}

/** Uploads validated receipt photos to a token-scoped Storage location. */
export async function uploadMaterialReceiptPhotos(
  link: ContractorActionLink,
  files: File[],
): Promise<Array<{ photo_url: string; storage_path: string }>> {
  if (files.length === 0) throw new Error("Add at least one delivery photo.");
  if (files.length > MATERIAL_RECEIPT_MAX_PHOTOS) {
    throw new Error(`Upload no more than ${MATERIAL_RECEIPT_MAX_PHOTOS} photos.`);
  }
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Material receipt uploads must be image files.");
    }
    if (file.size > MATERIAL_RECEIPT_MAX_FILE_BYTES) {
      throw new Error("Each photo must be 10 MB or smaller.");
    }
  }

  const storage = getFirebaseStorage();
  return Promise.all(
    files.map(async (file, index) => {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const storage_path = `material-receipts/${link.project_id}/${link.related_entity_id}/${link.token}/${Date.now()}-${index}-${safeName}`;
      const fileRef = storageRef(storage, storage_path);
      await uploadBytes(fileRef, file, { contentType: file.type });
      return {
        photo_url: await getDownloadURL(fileRef),
        storage_path,
      };
    }),
  );
}

export interface SubmitMaterialReceiptInput {
  link: ContractorActionLink;
  uploaded_by_name?: string;
  notes?: string;
  photos: Array<{ photo_url: string; storage_path: string }>;
}

/** Atomically records receipt proof, queues GC verification, and consumes the link. */
export async function submitMaterialReceipt(
  input: SubmitMaterialReceiptInput,
): Promise<MaterialReceiptUpload> {
  const freshLink = await getActionLinkByToken(input.link.token);
  if (
    !freshLink ||
    freshLink.status !== "Active" ||
    isActionLinkExpired(freshLink) ||
    freshLink.action_type !== "Material Receipt Upload" ||
    freshLink.related_entity_type !== "material_order" ||
    input.photos.length === 0 ||
    input.photos.length > MATERIAL_RECEIPT_MAX_PHOTOS
  ) {
    throw new Error("This receipt upload link is no longer active.");
  }

  const db = getDb();
  const receiptRef = doc(collection(db, COLLECTIONS.materialReceiptUploads));
  const orderRef = doc(db, COLLECTIONS.materialOrders, freshLink.related_entity_id);
  const linkRef = doc(db, COLLECTIONS.contractorActionLinks, freshLink.token);
  const activityRef = doc(collection(db, COLLECTIONS.activityLogs));
  const submittedBy = uid();
  const submittedAt = new Date().toISOString();
  const batch = writeBatch(db);

  batch.set(receiptRef, {
    material_order_id: freshLink.related_entity_id,
    project_id: freshLink.project_id,
    action_link_token: freshLink.token,
    uploaded_by_name: input.uploaded_by_name?.trim() || null,
    notes: input.notes?.trim() || null,
    photo_urls: input.photos.map((photo) => photo.photo_url),
    storage_paths: input.photos.map((photo) => photo.storage_path),
    submitted_by: submittedBy,
    submitted_at: serverTimestamp(),
    created_at: serverTimestamp(),
  });
  batch.update(orderRef, {
    status: "Pending Verification" as MaterialOrderStatus,
    receipt_upload_ids: arrayUnion(receiptRef.id),
    latest_receipt_upload_id: receiptRef.id,
    updated_at: serverTimestamp(),
  });
  batch.update(linkRef, {
    status: "Used" as ActionLinkStatus,
    used_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  batch.set(activityRef, {
    action_type: "material_receipt_submitted" as ActivityAction,
    entity_type: "material_order",
    entity_id: freshLink.related_entity_id,
    project_id: freshLink.project_id,
    user_id: submittedBy,
    action_link_token: freshLink.token,
    description: `Receipt photos submitted for ${freshLink.material_name ?? "material order"}`,
    created_at: serverTimestamp(),
  });
  await batch.commit();
  return {
    id: receiptRef.id,
    material_order_id: freshLink.related_entity_id,
    project_id: freshLink.project_id,
    action_link_token: freshLink.token,
    uploaded_by_name: input.uploaded_by_name?.trim() || null,
    notes: input.notes?.trim() || null,
    photo_urls: input.photos.map((photo) => photo.photo_url),
    storage_paths: input.photos.map((photo) => photo.storage_path),
    submitted_by: submittedBy,
    submitted_at: submittedAt,
    created_at: submittedAt,
  };
}

// ---------------------------------------------------------------------------
// Completion proof
// ---------------------------------------------------------------------------

export async function listCompletionRecords(
  tradePhaseId: string,
): Promise<CompletionRecord[]> {
  const phase = await getTradePhase(tradePhaseId);
  if (!phase) return [];
  const docs = await listForProject(COLLECTIONS.completionRecords, phase.project_id);
  return docs
    .map(mapCompletion)
    .filter((record) => record.trade_phase_id === tradePhaseId);
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
  await requireProjectPermission(input.project_id, "can_view_trade_phases");
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
  await requireProjectPermission(input.project_id, "can_edit_trade_phases");
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
  const phase = await getTradePhase(tradePhaseId);
  if (!phase) return [];
  const docs = await listForProject(COLLECTIONS.inspections, phase.project_id);
  return docs
    .map(mapInspection)
    .filter((inspection) => inspection.trade_phase_id === tradePhaseId);
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
  await requireProjectPermission(input.project_id, "can_edit_trade_phases");
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
  const phase = await getTradePhase(tradePhaseId);
  if (!phase) return [];
  const docs = await listForProject(COLLECTIONS.punchItems, phase.project_id);
  return docs
    .map(mapPunchItem)
    .filter((item) => item.trade_phase_id === tradePhaseId);
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
  const visibleProjectIds = filters.projectId
    ? new Set([filters.projectId])
    : await getProjectIdsWithSectionAccess("can_view_punch_items");
  const snap = await loadDocsByVisibleProjects(COLLECTIONS.punchItems, visibleProjectIds);
  let items = snap
    .map(mapPunchItem)
    .filter((item) => visibleProjectIds.has(item.project_id))
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
  await requireProjectPermission(input.project_id, "can_edit_punch_items");
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
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Punch item not found.");
  const before = mapPunchItem(snap as Snap);
  await requireProjectPermission(before.project_id, "can_edit_punch_items");
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
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Punch item not found.");
  const before = mapPunchItem(snap as Snap);
  await requireProjectPermission(before.project_id, "can_edit_punch_items");
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
  if (!snap.exists()) return null;
  const item = mapPunchItem(snap as Snap);
  const access = await getCurrentUserProjectAccess(item.project_id);
  return access && (access.can_view_punch_items || access.can_edit_punch_items)
    ? item
    : null;
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
  const currentUserId = uid();
  const recentSnap = await getDocs(
    query(
      collection(getDb(), COLLECTIONS.notifications),
      where("user_id", "==", currentUserId),
      queryLimit(DEDUPE_SCAN_LIMIT),
    ),
  );
  const nowMs = Date.now();
  const existing = recentSnap.docs
    .map((s) => mapNotification(s as Snap))
    .find((n) =>
      n.notification_type === input.notification_type &&
      n.related_entity_type === input.related_entity_type &&
      n.related_entity_id === input.related_entity_id &&
      n.message === input.message &&
      nowMs - new Date(n.created_at).getTime() <= NOTIFICATION_DEDUPE_WINDOW_MS,
    );
  if (existing) {
    return existing;
  }

  const ref = await addDoc(collection(getDb(), COLLECTIONS.notifications), {
    user_id: currentUserId,
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
  const userId = requireUid();
  const snap = await getDocs(
    query(
      collection(getDb(), COLLECTIONS.notifications),
      where("user_id", "==", userId),
      queryLimit(QUERY_COLLECTION_READ_LIMIT),
    ),
  );
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
  const visibleProjectIds = filters.projectId
    ? new Set([filters.projectId])
    : await getProjectIdsWithSectionAccess("can_view_documents");
  const snap = await loadDocsByVisibleProjects(COLLECTIONS.documents, visibleProjectIds);
  let docs = snap
    .map(mapDocument)
    .filter((doc) => visibleProjectIds.has(doc.project_id))
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
  if (!snap.exists()) return null;
  const document = mapDocument(snap as Snap);
  const access = await getCurrentUserProjectAccess(document.project_id);
  return access && (access.can_view_documents || access.can_edit_documents)
    ? document
    : null;
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
  await requireProjectPermission(input.project_id, "can_edit_documents");
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
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Document not found.");
  const before = mapDocument(snap as Snap);
  await requireProjectPermission(before.project_id, "can_edit_documents");
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
    contractor_id: (data.contractor_id as string | null) ?? null,
    project_id: data.project_id as string,
    material_name: (data.material_name as string | null) ?? null,
    supplier_name: (data.supplier_name as string | null) ?? null,
    expected_arrival_date:
      (data.expected_arrival_date as string | null) ?? null,
    project_name: (data.project_name as string | null) ?? null,
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
  contractor_id: string | null;
  project_id: string;
  /** Optional explicit entity type; inferred from action_type when omitted. */
  related_entity_type?: ActionLinkEntityType;
  /** Optional explicit ISO expiry; defaults to the standard TTL when omitted. */
  expiration_date?: string;
}

/**
 * Creates a contractor action link. The unguessable token is also used as the
 * Firestore document id, so the link can only be opened by someone who has the
 * token (the collection is never listed publicly).
 */
export async function createActionLink(
  input: NewActionLinkInput,
): Promise<ContractorActionLink> {
  const userId = requireUid();
  await requireProjectPermission(input.project_id, "can_edit_project");
  const relatedEntityType =
    input.related_entity_type ?? entityTypeForAction(input.action_type);

  const existingSnap = await getDocs(
    query(
      collection(getDb(), COLLECTIONS.contractorActionLinks),
      where("created_by", "==", userId),
      queryLimit(DEDUPE_SCAN_LIMIT),
    ),
  );
  const existingActive = existingSnap.docs
    .map((d) => mapActionLink(d as Snap))
    .find((link) =>
      link.status === "Active" &&
      !isActionLinkExpired(link) &&
      link.action_type === input.action_type &&
      link.related_entity_type === relatedEntityType &&
      link.related_entity_id === input.related_entity_id &&
      link.contractor_id === input.contractor_id &&
      link.project_id === input.project_id,
    );
  if (existingActive) {
    return existingActive;
  }

  const token = generateActionToken();
  const expirationDate = input.expiration_date ?? defaultExpiration();
  const ref = doc(getDb(), COLLECTIONS.contractorActionLinks, token);
  await setDoc(ref, {
    created_by: userId,
    token,
    action_type: input.action_type,
    related_entity_type: relatedEntityType,
    related_entity_id: input.related_entity_id,
    contractor_id: input.contractor_id,
    project_id: input.project_id,
    expiration_date: expirationDate,
    expiration_at: Timestamp.fromDate(new Date(expirationDate)),
    material_name: null,
    supplier_name: null,
    expected_arrival_date: null,
    project_name: null,
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
  if (!snap.exists()) return null;
  const link = mapActionLink(snap as Snap);
  if (link.status === "Active" && isActionLinkExpired(link))
    return { ...link, status: "Expired" };
  return link;
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
  const userId = requireUid();
  const snap = await getDocs(
    query(
      collection(getDb(), COLLECTIONS.contractorActionLinks),
      where("created_by", "==", userId),
      queryLimit(QUERY_COLLECTION_READ_LIMIT),
    ),
  );
  let links = snap.docs.map((d) => mapActionLink(d as Snap));

  const expiredActiveLinks = links.filter(
    (link) => link.status === "Active" && isActionLinkExpired(link),
  );
  if (expiredActiveLinks.length > 0) {
    await Promise.all(
      expiredActiveLinks.map((link) =>
        updateDoc(doc(getDb(), COLLECTIONS.contractorActionLinks, link.token), {
          status: "Expired" as ActionLinkStatus,
          updated_at: serverTimestamp(),
        }),
      ),
    );
    const expiredSet = new Set(expiredActiveLinks.map((link) => link.token));
    links = links.map((link) =>
      expiredSet.has(link.token) ? { ...link, status: "Expired" } : link,
    );
  }

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
