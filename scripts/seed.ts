/**
 * TradeFlow development seed script.
 * -----------------------------------------------------------------------------
 * Populates Cloud Firestore with a realistic sample project so the dashboard
 * and trade-phase screens look alive during development.
 *
 * SAFETY:
 *  - Uses the Firebase Admin SDK (server-only) which bypasses Firestore
 *    security rules. It authenticates with Application Default Credentials, so
 *    no key file is committed to the repo.
 *  - Refuses to run when NODE_ENV is "production".
 *  - Is idempotent: if the demo project already exists it exits without
 *    touching any data, so it can never overwrite or duplicate real records.
 *
 * CREDENTIALS — pick ONE before running:
 *  - Run `gcloud auth application-default login` (recommended for local dev), OR
 *  - Set GOOGLE_APPLICATION_CREDENTIALS to the path of a service-account JSON
 *    key downloaded from the Firebase console (Project settings → Service
 *    accounts → Generate new private key).
 *
 * Run it with:   npm run seed
 * (which loads variables from .env.local first)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Load environment variables from .env.local (simple, dependency-free parser).
// ---------------------------------------------------------------------------
function loadEnvLocal() {
  try {
    const file = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of file.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env.local file — rely on already-set environment variables.
  }
}

loadEnvLocal();

const DEMO_PROJECT_NAME = "Maple Street Apartments (Demo)";
const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  "ammonssoftware";

/** Returns a YYYY-MM-DD string offset from today by the given days. */
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Initialize the Admin SDK. Prefers an explicit service-account key file if
 * GOOGLE_APPLICATION_CREDENTIALS points at one; otherwise falls back to
 * Application Default Credentials (e.g. from `gcloud auth ...`).
 */
function initAdmin() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    try {
      const json = JSON.parse(readFileSync(resolve(keyPath), "utf8"));
      return initializeApp({
        credential: cert(json),
        projectId: json.project_id || PROJECT_ID,
      });
    } catch (err) {
      console.error(
        `Failed to read service-account key at ${keyPath}:`,
        (err as Error).message,
      );
      process.exit(1);
    }
  }
  return initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  });
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed: NODE_ENV is 'production'.");
    process.exit(1);
  }

  initAdmin();
  const db = getFirestore();
  const now = () => FieldValue.serverTimestamp();

  // Guard: skip entirely if the demo project already exists.
  const existing = await db
    .collection("projects")
    .where("name", "==", DEMO_PROJECT_NAME)
    .limit(1)
    .get();

  if (!existing.empty) {
    console.log(
      `Demo project already exists (id: ${existing.docs[0].id}). Nothing to do.`,
    );
    return;
  }

  console.log("Seeding demo data…");

  // 1) Project --------------------------------------------------------------
  const projectRef = await db.collection("projects").add({
    name: DEMO_PROJECT_NAME,
    location: "123 Maple St, Springfield",
    start_date: dateOffset(-30),
    estimated_end_date: dateOffset(120),
    notes: "40-unit apartment build used as TradeFlow demo data.",
    created_by: null,
    created_at: now(),
    updated_at: now(),
  });
  const projectId = projectRef.id;

  // 2) Contractors ----------------------------------------------------------
  const contractorDefs = [
    {
      company_name: "Apex Framing Co.",
      contact_name: "Maria Lopez",
      phone: "(555) 200-1010",
      email: "maria@apexframing.com",
      trade_specialty: "Framing",
    },
    {
      company_name: "ClearFlow Plumbing",
      contact_name: "Dan Okafor",
      phone: "(555) 200-2020",
      email: "dan@clearflowplumbing.com",
      trade_specialty: "Plumbing",
    },
    {
      company_name: "BrightSpark Electric",
      contact_name: "Wei Chen",
      phone: "(555) 200-3030",
      email: "wei@brightspark.com",
      trade_specialty: "Electrical",
    },
    {
      company_name: "Summit HVAC",
      contact_name: "Tara Singh",
      phone: "(555) 200-4040",
      email: "tara@summithvac.com",
      trade_specialty: "HVAC",
    },
  ];

  const contractorIdBySpecialty = new Map<string, string>();
  for (const c of contractorDefs) {
    const ref = await db.collection("contractors").add({
      ...c,
      notes: null,
      created_by: null,
      created_at: now(),
      updated_at: now(),
    });
    contractorIdBySpecialty.set(c.trade_specialty, ref.id);
  }

  const contractorFor = (specialty: string | null) =>
    specialty ? contractorIdBySpecialty.get(specialty) ?? null : null;

  // 3) Trades ---------------------------------------------------------------
  const tradeDefs: { name: string; specialty: string | null }[] = [
    { name: "Framing", specialty: "Framing" },
    { name: "Plumbing", specialty: "Plumbing" },
    { name: "Electrical", specialty: "Electrical" },
    { name: "HVAC", specialty: "HVAC" },
    { name: "Drywall", specialty: null },
    { name: "Paint", specialty: null },
    { name: "Flooring", specialty: null },
  ];

  const tradeIdByName = new Map<string, string>();
  for (const t of tradeDefs) {
    const ref = await db.collection("trades").add({
      project_id: projectId,
      name: t.name,
      description: `${t.name} work for ${DEMO_PROJECT_NAME}.`,
      default_contractor_id: contractorFor(t.specialty),
      created_by: null,
      created_at: now(),
      updated_at: now(),
    });
    tradeIdByName.set(t.name, ref.id);
  }

  // 4) Trade phases (varied statuses + dates for a realistic dashboard) ------
  const phaseDefs: {
    trade: string;
    contractor: string | null;
    title: string;
    status: string;
    start: string;
    end: string;
  }[] = [
    {
      trade: "Framing",
      contractor: "Framing",
      title: "Building A — 2nd floor framing",
      status: "In Progress",
      start: dateOffset(0),
      end: dateOffset(5),
    },
    {
      trade: "Framing",
      contractor: "Framing",
      title: "Building B — roof framing",
      status: "Scheduled",
      start: dateOffset(7),
      end: dateOffset(12),
    },
    {
      trade: "Plumbing",
      contractor: "Plumbing",
      title: "Building A — rough-in plumbing",
      status: "Materials Pending",
      start: dateOffset(3),
      end: dateOffset(9),
    },
    {
      trade: "Electrical",
      contractor: "Electrical",
      title: "Building A — panel + rough-in",
      status: "Blocked",
      start: dateOffset(-2),
      end: dateOffset(4),
    },
    {
      trade: "HVAC",
      contractor: "HVAC",
      title: "Building A — ductwork",
      status: "Ready to Schedule",
      start: dateOffset(10),
      end: dateOffset(16),
    },
    {
      trade: "Drywall",
      contractor: null,
      title: "Building A — hang & finish drywall",
      status: "Not Ready",
      start: dateOffset(20),
      end: dateOffset(30),
    },
    {
      trade: "Paint",
      contractor: null,
      title: "Building A — interior paint",
      status: "Submitted Complete",
      start: dateOffset(-10),
      end: dateOffset(-3),
    },
    {
      trade: "Flooring",
      contractor: null,
      title: "Units 101-110 — LVP flooring",
      status: "Needs Inspection",
      start: dateOffset(-5),
      end: dateOffset(0),
    },
    {
      trade: "Plumbing",
      contractor: "Plumbing",
      title: "Units 101-110 — fixture set",
      status: "Approved",
      start: dateOffset(-14),
      end: dateOffset(-8),
    },
  ];

  const phases: { id: string; title: string }[] = [];
  for (const p of phaseDefs) {
    const ref = await db.collection("tradePhases").add({
      project_id: projectId,
      trade_id: tradeIdByName.get(p.trade)!,
      contractor_id: contractorFor(p.contractor),
      title: p.title,
      description: `${p.trade} work — ${p.title}.`,
      status: p.status,
      scheduled_start_date: p.start,
      scheduled_end_date: p.end,
      created_by: null,
      created_at: now(),
      updated_at: now(),
    });
    phases.push({ id: ref.id, title: p.title });
  }

  // 5) A few activity log entries so the dashboard feed isn't empty ----------
  const activityDefs = [
    {
      action_type: "project_created",
      entity_type: "project",
      entity_id: projectId,
      description: `Project "${DEMO_PROJECT_NAME}" was created`,
    },
    {
      action_type: "trade_phase_created",
      entity_type: "trade_phase",
      entity_id: phases[0].id,
      description: `Trade phase "${phases[0].title}" was created`,
    },
    {
      action_type: "trade_phase_status_updated",
      entity_type: "trade_phase",
      entity_id: phases[3].id,
      description: `"${phases[3].title}" status changed to Blocked`,
    },
  ];
  for (const a of activityDefs) {
    await db.collection("activityLogs").add({
      ...a,
      project_id: projectId,
      user_id: null,
      created_at: now(),
    });
  }

  // 6) Material orders (varied statuses incl. delayed/received/arriving) -----
  const materialDefs: {
    name: string;
    supplier: string;
    phaseIndex: number;
    trade: string;
    status: string;
    expected: string;
    actual: string | null;
  }[] = [
    {
      name: "Framing lumber package",
      supplier: "Springfield Building Supply",
      phaseIndex: 0,
      trade: "Framing",
      status: "Received",
      expected: dateOffset(-4),
      actual: dateOffset(-4),
    },
    {
      name: "PEX tubing + fittings",
      supplier: "ClearFlow Supply",
      phaseIndex: 2,
      trade: "Plumbing",
      status: "Ordered",
      expected: dateOffset(2),
      actual: null,
    },
    {
      name: "200A electrical panel",
      supplier: "BrightSpark Distribution",
      phaseIndex: 3,
      trade: "Electrical",
      status: "Delayed",
      expected: dateOffset(-1),
      actual: null,
    },
    {
      name: "Ductwork + registers",
      supplier: "Summit Mechanical Supply",
      phaseIndex: 4,
      trade: "HVAC",
      status: "Arriving",
      expected: dateOffset(0),
      actual: null,
    },
    {
      name: "Roofing trusses",
      supplier: "Springfield Building Supply",
      phaseIndex: 1,
      trade: "Framing",
      status: "Delayed",
      expected: dateOffset(-2),
      actual: null,
    },
    {
      name: "Interior paint (40 units)",
      supplier: "ProCoat Paints",
      phaseIndex: 6,
      trade: "Paint",
      status: "Received",
      expected: dateOffset(-12),
      actual: dateOffset(-11),
    },
    {
      name: "LVP flooring pallets",
      supplier: "FloorWorks",
      phaseIndex: 7,
      trade: "Flooring",
      status: "Received",
      expected: dateOffset(-6),
      actual: dateOffset(-6),
    },
  ];
  for (const m of materialDefs) {
    await db.collection("materialOrders").add({
      name: m.name,
      supplier: m.supplier,
      expected_arrival_date: m.expected,
      actual_arrival_date: m.actual,
      status: m.status,
      notes: null,
      project_id: projectId,
      trade_phase_id: phases[m.phaseIndex].id,
      trade_id: tradeIdByName.get(m.trade)!,
      created_by: null,
      created_at: now(),
      updated_at: now(),
    });
  }

  // 7) Completion submissions ------------------------------------------------
  // Paint phase is awaiting review; the approved plumbing phase has a reviewed
  // record so the approval history is visible.
  await db.collection("completionRecords").add({
    trade_phase_id: phases[6].id,
    project_id: projectId,
    submitted_by: null,
    notes: "Final coat complete in all units on floors 1-3. Touch-ups done.",
    photo_urls: [],
    status: "Submitted",
    submitted_at: now(),
    review_notes: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: now(),
    updated_at: now(),
  });
  await db.collection("completionRecords").add({
    trade_phase_id: phases[8].id,
    project_id: projectId,
    submitted_by: null,
    notes: "Fixtures set and tested in units 101-110. No leaks.",
    photo_urls: [],
    status: "Approved",
    submitted_at: now(),
    review_notes: "Verified on walkthrough — approved.",
    reviewed_by: null,
    reviewed_at: now(),
    created_at: now(),
    updated_at: now(),
  });

  // 8) Punch items (varied priority/status, incl. an overdue + a resolved) ---
  const punchDefs: {
    phaseIndex: number;
    title: string;
    description: string;
    contractor: string | null;
    priority: string;
    status: string;
    due: string;
    resolved: boolean;
  }[] = [
    {
      phaseIndex: 0,
      title: "Missing hurricane ties on north wall",
      description: "Add ties per plan detail S-4 before inspection.",
      contractor: "Framing",
      priority: "High",
      status: "Open",
      due: dateOffset(2),
      resolved: false,
    },
    {
      phaseIndex: 8,
      title: "Leak at unit 103 sink trap",
      description: "Slow drip under the kitchen sink; reseat the trap.",
      contractor: "Plumbing",
      priority: "Critical",
      status: "In Progress",
      due: dateOffset(-1),
      resolved: false,
    },
    {
      phaseIndex: 7,
      title: "Scuff on LVP near unit 104 entry",
      description: "Replace the scuffed plank by the entry threshold.",
      contractor: null,
      priority: "Low",
      status: "Open",
      due: dateOffset(5),
      resolved: false,
    },
    {
      phaseIndex: 6,
      title: "Paint drip on unit 207 trim",
      description: "Sand and recoat the window trim.",
      contractor: null,
      priority: "Medium",
      status: "Resolved",
      due: dateOffset(-3),
      resolved: true,
    },
  ];
  for (const p of punchDefs) {
    await db.collection("punchItems").add({
      trade_phase_id: phases[p.phaseIndex].id,
      project_id: projectId,
      title: p.title,
      description: p.description,
      assigned_contractor_id: contractorFor(p.contractor),
      due_date: p.due,
      priority: p.priority,
      status: p.status,
      resolved_at: p.resolved ? now() : null,
      created_by: null,
      created_at: now(),
      updated_at: now(),
    });
  }

  // 9) Recent Sprint 2 activity + notifications ------------------------------
  const sprint2Activity = [
    {
      action_type: "material_order_status_updated",
      entity_type: "material_order",
      entity_id: projectId,
      description: 'Material order "200A electrical panel" marked Delayed',
    },
    {
      action_type: "completion_submitted",
      entity_type: "trade_phase",
      entity_id: phases[6].id,
      description: "Completion proof submitted",
    },
    {
      action_type: "punch_item_created",
      entity_type: "punch_item",
      entity_id: phases[0].id,
      description: "Punch item added: Missing hurricane ties on north wall",
    },
    {
      action_type: "inspection_recorded",
      entity_type: "trade_phase",
      entity_id: phases[8].id,
      description: "Completion approved",
    },
  ];
  for (const a of sprint2Activity) {
    await db.collection("activityLogs").add({
      ...a,
      project_id: projectId,
      user_id: null,
      created_at: now(),
    });
  }

  const notificationDefs = [
    {
      recipient_id: null,
      notification_type: "completion_submitted",
      related_entity_type: "completion_record",
      related_entity_id: phases[6].id,
      message: "Completion proof was submitted for review.",
    },
    {
      recipient_id: contractorFor("Plumbing"),
      notification_type: "punch_item_assigned",
      related_entity_type: "punch_item",
      related_entity_id: phases[8].id,
      message: "New punch item assigned: Leak at unit 103 sink trap",
    },
    {
      recipient_id: null,
      notification_type: "material_delayed",
      related_entity_type: "material_order",
      related_entity_id: phases[3].id,
      message: 'Material order "200A electrical panel" is delayed.',
    },
  ];
  for (const n of notificationDefs) {
    await db.collection("notifications").add({
      ...n,
      status: "unread",
      created_at: now(),
    });
  }

  console.log("✓ Seed complete:");
  console.log(`  • 1 project: ${DEMO_PROJECT_NAME}`);
  console.log(`  • ${contractorDefs.length} contractors`);
  console.log(`  • ${tradeDefs.length} trades`);
  console.log(`  • ${phases.length} trade phases`);
  console.log(`  • ${materialDefs.length} material orders`);
  console.log(`  • 2 completion submissions`);
  console.log(`  • ${punchDefs.length} punch items`);
  console.log(`  • ${notificationDefs.length} notifications`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
