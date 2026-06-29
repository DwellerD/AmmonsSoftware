# TradeFlow

> Mobile-first construction workflow app for general contractors and site
> supervisors.

TradeFlow helps a GC manage **trade readiness, material tracking, contractor
scheduling, completion proof, inspection approvals, punch lists, and daily
project visibility** — all from their phone or desktop.

This repository contains the **Sprint 2** build (material tracking, completion
proof, GC inspection approvals, and punch items) on top of the Sprint 1
foundation.

---

## The problem it solves

On a busy job site, a general contractor juggles dozens of trades across
multiple buildings. Knowing _what is ready, what is blocked, who is scheduled,
and what needs inspection_ usually lives in texts, spreadsheets, and the GC's
head. TradeFlow turns that into a single, structured, auditable system so the
GC can start each day with a clear overview and keep every piece of work moving.

## Tech stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript** throughout
- **Tailwind CSS v4** (configured in `src/app/globals.css`)
- **Firebase** — **Authentication** (email/password) + **Cloud Firestore** +
  **Cloud Storage** (completion photos)

## Project structure

```
src/
  app/
    page.tsx                 Public landing page ("TradeFlow is running")
    login/                   Login / sign-up screen
    (app)/                   Authenticated area (shares nav + auth guard)
      layout.tsx             Client-side auth guard, renders the AppShell
      dashboard/             GC daily dashboard
      projects/              Projects list + detail
      trades/                Trades list + create
      contractors/           Contractors list + create
      trade-phases/          Trade phase list, create form, detail
      material-orders/       Material tracking list + create form
      punch-items/           Punch list across all projects
      notifications/         In-app notification records (dev/testing view)
  components/
    ui/                      Reusable UI primitives (Button, Card, Field, …)
    layout/AppShell.tsx      Sidebar + mobile nav
    auth/                    Login form + logout button
    forms/                   Trade phase + material order forms
    phase/                   Phase detail sections (materials, completion, punch)
    providers/               AuthProvider (Firebase auth state + role)
  lib/
    firebase/client.ts       Firebase app/Auth/Firestore/Storage initialization
    api.ts                   Data-access layer (all Firestore queries live here)
    constants.ts             Roles, statuses, status colors
    database.types.ts        TypeScript types for every collection
    materials.ts             Material readiness helper
    format.ts                Date/time formatting helpers
firestore.rules              Firestore security rules
storage.rules                Cloud Storage security rules (completion photos)
firestore.indexes.json       Firestore composite index definitions
firebase.json                Firebase CLI config (Firestore + Storage rules)
.firebaserc                  Default Firebase project (ammonssoftware)
scripts/
  seed.ts                    Safe demo-data seeder (npm run seed)
```

---

## Running the app locally

### 1. Install dependencies

```bash
npm install
```

### 2. Set up a Firebase project

1. Go to <https://console.firebase.google.com> and open (or create) the project
   `ammonssoftware`.
2. **Build → Authentication → Get started**, then enable the
   **Email/Password** sign-in provider.
3. **Build → Firestore Database → Create database** (start in production mode;
   the rules in this repo lock it down to signed-in users).
4. **Build → Storage → Get started** to provision the default Cloud Storage
   bucket (used for completion photos in Sprint 2). The `storage.rules` in this
   repo restrict uploads to signed-in users and image files under 15 MB.
5. **Project settings → General → Your apps → Web app** (`</>`). Register a web
   app to obtain its config values (`apiKey`, `appId`, etc.).

### 3. Configure environment variables

Copy the example file and fill in the values from your Firebase **web app
config**:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Used for |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ | Browser SDK auth (safe to expose) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ | Firestore / project targeting |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ✅ | Storage bucket (Sprint 2) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Cloud messaging / project number |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ✅ | Identifies this web app |
| `GOOGLE_APPLICATION_CREDENTIALS` | Only for seeding | Path to a service-account key so `npm run seed` (Admin SDK) can write data. **Server-only — never expose to the browser.** |

The `NEXT_PUBLIC_FIREBASE_*` values are public by design (the browser SDK needs
them); access is controlled by Firestore security rules and Auth, not by hiding
these keys. `.env.local` is git-ignored.

### 4. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. You should see the **"TradeFlow is running"**
landing page. Click **Sign in**, create an account, and you'll land on the
dashboard.

### 5. Deploy Firestore and Storage security rules

The repo ships with `firestore.rules` and `storage.rules`. Deploy them with the
Firebase CLI:

```bash
npx firebase deploy --only firestore:rules
npx firebase deploy --only storage
```

(`npx firebase login` first if you haven't authenticated the CLI. The Storage
bucket must be provisioned in the console — step 4 above — before the storage
rules will deploy.)

### 6. (Optional) Load demo data

The seeder uses the **Firebase Admin SDK**, which needs credentials. Pick one:

- `gcloud auth application-default login` (recommended for local dev), **or**
- download a service-account key (Firebase **Project settings → Service
  accounts → Generate new private key**) and point `GOOGLE_APPLICATION_CREDENTIALS`
  at the JSON file.

Then run:

```bash
npm run seed
```

This creates a sample 40-unit apartment project with contractors, trades, and
trade phases in various statuses — plus Sprint 2 data: material orders (varied
statuses including delayed/received/arriving), completion submissions, punch
items (including an overdue and a resolved one), recent activity, and
notification records — so the dashboard looks realistic. The seeder is
**safe**: it refuses to run in production and skips entirely if the demo project
already exists.

---

## How Firebase is used

- **Auth** — email/password sign-in via Firebase Authentication. The login form
  creates the account and writes a `users/{uid}` profile document (with a
  default role). `AuthProvider` exposes the current user + role to the app via
  the `useAuth()` hook.
- **Firestore** — a NoSQL document store holds `projects`, `contractors`,
  `trades`, `tradePhases`, `activityLogs`, `users`, and the Sprint 2
  collections: `materialOrders`, `completionRecords`, `inspections`,
  `punchItems`, and `notifications`. Firestore has no joins, so the data layer
  (`src/lib/api.ts`) loads related collections and stitches names together in
  memory.
- **Storage** — Cloud Storage holds completion photos under
  `completion/{tradePhaseId}/`. The contractor submission flow uploads the
  files, then stores their download URLs on the Firestore `completionRecords`
  document. `storage.rules` allow signed-in users to read, and to upload image
  files up to 15 MB.
- **Security rules** — `firestore.rules` restricts all collections to
  signed-in users (with users only able to write their own profile, and
  append-only activity logs / create-only inspections). `storage.rules`
  similarly gate uploads to signed-in users. Project-scoped restrictions are
  planned for a later sprint.
- **Route protection** — auth is client-side. The `(app)` layout is a client
  component that waits for auth state, then redirects unauthenticated visitors
  to `/login`.

---

## Sprint 1 feature set

- ✅ Next.js + TypeScript project foundation
- ✅ Tailwind base UI (buttons, cards, fields, badges, page layout)
- ✅ Firebase connection (Auth + Firestore client)
- ✅ Firestore data model: projects, trades, contractors, trade phases, activity logs
- ✅ Email/password authentication with protected routes and logout
- ✅ User roles (`admin`, `gc_site_super`, `internal_team`, `contractor`)
- ✅ Authenticated app layout with desktop + mobile navigation
- ✅ Project management (list, create, detail)
- ✅ Trade management (list, create)
- ✅ Contractor management (list, create)
- ✅ Trade phases: create form, filterable list, detail page with status updates
- ✅ Activity logging on key actions
- ✅ GC daily dashboard (active / today / blocked / needs-inspection + feeds)
- ✅ Safe demo-data seeder
- ✅ Deployment-ready production build

## Trade phase statuses

`Not Ready` → `Materials Pending` → `Ready to Schedule` → `Scheduled` →
`In Progress` → `Submitted Complete` → `Needs Inspection` → `Approved`
(plus `Blocked`).

---

## Sprint 2 feature set

Built on top of the Sprint 1 foundation:

- ✅ **Material tracking** — material orders with supplier, expected/actual
  arrival, and lifecycle status (`Needed` → `Ordered` → `Arriving` →
  `Received`, plus `Delayed` / `Cancelled`); filterable list and a per-phase
  materials readiness banner.
- ✅ **Completion proof** — contractors submit notes + one or more photos from
  their phone; photos upload to Firebase Storage and metadata is stored in
  Firestore. Submitting moves the phase to `Submitted Complete`.
- ✅ **GC inspection approval** — the GC reviews a submission and either
  approves it (phase → `Approved`) or sends it back as needs-fix (phase →
  `In Progress`) with inspection notes. Each decision is logged and recorded.
- ✅ **Punch items** — title, description, assigned contractor, priority
  (`Low`/`Medium`/`High`/`Critical`), due date, and status
  (`Open` → `In Progress` → `Resolved` → `Closed`). Created from a phase and
  managed on a dedicated punch list with project/status/contractor filters.
- ✅ **Dashboard updates** — materials arriving today, delayed materials,
  phases submitted for review, phases needing inspection, and open/overdue
  punch items.
- ✅ **Notification records** — in-app records created when completion proof is
  submitted, a punch item is assigned, or a material is marked delayed (no real
  SMS/email/push yet), viewable on the Notifications screen for dev/testing.
- ✅ **Storage security rules** + updated seed data covering all of the above.

### What's **not** included in Sprint 2

- Real notification delivery (SMS / email / push) — only records are created
- Photo annotation / markup
- Documents (drawings, contracts, change orders)
- Per-project / per-role data restrictions (rules are still permissive)

---

## Intentionally **not** included yet

To keep the current scope focused, these are deliberately left out:

- Payment processing and accounting integrations
- Bid comparison / bidding tools
- Native mobile apps
- AI features
- Blueprint markup
- Complex scheduling (Gantt, dependencies, critical path)
- Per-project / per-role data restrictions (rules are permissive for now)

## Planned next: Sprint 3

Recommended focus areas for the next sprint:

- **Real notification delivery** — wire the notification records to email/SMS
  (e.g. Firebase Cloud Functions + a provider like SendGrid/Twilio) and add a
  per-user inbox with unread counts.
- **Documents** — drawings, contracts, and change orders via Firebase Storage,
  attached to projects and phases.
- **Project-scoped security rules** — per-project membership and role checks in
  both Firestore and Storage rules, replacing the permissive MVP rules.
- **Punch item photos** — let contractors attach before/after photos to punch
  items, reusing the completion-photo upload pattern.
- **Reporting / exports** — per-project status and punch-list summaries (PDF/CSV)
  for owners and inspectors.
- **Scheduling** — calendar/Gantt view of phases with dependencies.

---

## Deployment

The app is a standard Next.js build and can be hosted on any platform that runs
Next.js. **Firebase App Hosting** is a natural fit since the backend already
lives in Firebase, but Vercel or any Node host works too.

1. Push this repository to your Git provider.
2. Import it into your host (Firebase App Hosting, Vercel, etc.).
3. Add the `NEXT_PUBLIC_FIREBASE_*` environment variables from the table above
   in the host's project settings.
4. Make sure your Firestore and Storage security rules are deployed:

   ```bash
   npx firebase deploy --only firestore:rules
   npx firebase deploy --only storage
   ```

5. Deploy. The production build is verified with:

   ```bash
   npm run build
   ```
