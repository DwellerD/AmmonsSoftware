# TradeFlow

> Mobile-first construction workflow app for general contractors and site
> supervisors.

TradeFlow helps a GC manage **trade readiness, material tracking, contractor
scheduling, completion proof, inspection approvals, punch lists, a document
vault, lightweight contractor action links, and daily project visibility** —
all from their phone or desktop.

This repository contains the **Sprint 3** build (a document vault, tokenized
contractor action links for schedule confirmations and punch updates, and a
real notification workflow structure) on top of the Sprint 1 and Sprint 2
foundations.

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
- **Firebase** — **Authentication** (email/password, plus anonymous sessions for
  contractor action links) + **Cloud Firestore** + **Cloud Storage**
  (completion photos and project documents)

## Project structure

```
src/
  app/
    page.tsx                 Public landing page ("TradeFlow is running")
    login/                   Login / sign-up screen
    link/[token]/            Public contractor action link (no login required)
    (app)/                   Authenticated area (shares nav + auth guard)
      layout.tsx             Client-side auth guard, renders the AppShell
      dashboard/             GC daily dashboard
      projects/              Projects list + detail
      trades/                Trades list + create
      contractors/           Contractors list + create
      trade-phases/          Trade phase list, create form, detail
      material-orders/       Material tracking list + create form
      punch-items/           Punch list across all projects
      documents/             Document Vault (list, search/filter, upload)
      notifications/         Notification history (records + filters)
  components/
    ui/                      Reusable UI primitives (Button, Card, Field, …)
    layout/AppShell.tsx      Sidebar + mobile nav (role-aware)
    auth/                    Login form + logout button
    forms/                   Trade phase, material order + document upload forms
    phase/                   Phase detail sections (materials, completion, punch,
                             documents, schedule confirmation, link buttons)
    documents/               Pinned plans section for project detail
    contractor/              Public contractor action link screens
    providers/               AuthProvider (Firebase auth state + role)
  lib/
    firebase/client.ts       Firebase app/Auth/Firestore/Storage + anon session
    api.ts                   Data-access layer (all Firestore queries live here)
    constants.ts             Roles, statuses, status colors, document/link types
    database.types.ts        TypeScript types for every collection
    materials.ts             Material readiness helper
    documents.ts             Document helpers (type inference, tags, sizes, paths)
    actionLinks.ts           Tokenized link helpers (generate/validate/expire)
    notifications.ts         Notification delivery service structure
    format.ts                Date/time formatting helpers
firestore.rules              Firestore security rules
storage.rules                Cloud Storage security rules (photos + documents)
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
   **Email/Password** sign-in provider. Also enable the **Anonymous** provider —
   the schedule-confirmation action link signs visitors in anonymously so their
   reads/writes satisfy the `signedIn()` Firestore rules without a full account.
3. **Build → Firestore Database → Create database** (start in production mode;
   the rules in this repo lock it down to signed-in users).
4. **Build → Storage → Get started** to provision the default Cloud Storage
   bucket. It stores completion photos and project documents. The
   `storage.rules` in this repo restrict completion-photo uploads to image
   files under 15 MB and project-document uploads to signed-in users under
   25 MB.
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
| `NEXT_PUBLIC_NOTIFICATIONS_EMAIL_ENABLED` | — | **Reserved / disabled.** A future hook for email delivery. The current MVP does not send email or SMS, so this has no effect today. |
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
trade phases in various statuses — plus Sprint 2 data (material orders,
completion submissions, punch items, recent activity) and Sprint 3 data:
project documents (including pinned blueprints/layouts, a contract, an invoice,
a change order, and a permit), tokenized contractor action links (an active
schedule confirmation, an active punch update, and a used link), example
schedule confirmations (pending and declined), a contractor punch-item update,
and notification records covering the new event types — so the dashboard,
document vault, and notification history look realistic. The seeder is
**safe**: it refuses to run in production and skips entirely if the demo project
already exists.

> Because the seeder skips when the demo project exists, re-running it will
> **not** add the new Sprint 3 data to an already-seeded database. To pick up
> the Sprint 3 demo records, delete the existing `Maple Street Apartments
> (Demo)` project (and its related docs) first, then run `npm run seed` again.

---

## How Firebase is used

- **Auth** — email/password sign-in via Firebase Authentication. The login form
  creates the account and writes a `users/{uid}` profile document (with a
  default role). `AuthProvider` exposes the current user + role to the app via
  the `useAuth()` hook. **Anonymous sessions** are used for contractor action
  links: the public `/link/[token]` page signs the visitor in anonymously
  (`ensureAnonymousSession()`) so their reads/writes satisfy the `signedIn()`
  rules without a full account.
- **Firestore** — a NoSQL document store holds `projects`, `contractors`,
  `trades`, `tradePhases`, `activityLogs`, `users`, the Sprint 2 collections
  (`materialOrders`, `completionRecords`, `inspections`, `punchItems`,
  `notifications`), and the Sprint 3 collections: `documents` (the document
  vault) and `contractorActionLinks` (tokenized links). Firestore has no joins,
  so the data layer (`src/lib/api.ts`) loads related collections and stitches
  names together in memory.
- **Storage** — Cloud Storage holds completion photos under
  `completion/{tradePhaseId}/` and project documents under
  `documents/{projectId}/`. Upload flows push the files, then store their
  download URLs (and the storage path) on the relevant Firestore document.
  `storage.rules` allow signed-in users to read, restrict completion-photo
  uploads to image files up to 15 MB, and restrict document uploads to any file
  type up to 25 MB.
- **Contractor action links (schedule confirmation only)** — instead of giving
  subcontractors full accounts, the GC generates a tokenized link for a single
  action. In the current MVP this is used for **schedule confirmation**: the
  token doubles as the Firestore document id so an unauthenticated visitor can
  fetch exactly one link by URL; `actionLinks.ts` generates, validates, and
  expires it (status `Active` → `Used` / `Expired` / `Revoked`, default 14-day
  TTL). The public screen confirms the schedule against the expected phase and
  marks the link used. *Other action-link types (punch update, document
  request, completion submission) are scaffolded but disabled — see below.*
- **Internal notification records** — `notifications.ts` records a Firestore
  `notifications` document for key workflow events (`dispatchNotification`) so
  they appear in history. **No email/SMS/push is sent.** The email/SMS
  “prepare” helpers are preserved as a future seam but are not called. There is
  no automated messaging in this build.
- **Security rules** — `firestore.rules` restricts collections to signed-in
  users (users only write their own profile; activity logs are append-only;
  inspections are create-only). `contractorActionLinks` allow an unauthenticated
  `get` by token (so a contractor can open their schedule-confirmation link) but
  restrict listing and writes to signed-in users. `storage.rules` similarly gate
  uploads to signed-in users. Project-scoped restrictions are planned for a
  later sprint.
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

## Sprint 3 feature set

Built on top of the Sprint 1 and Sprint 2 foundations:

- ✅ **Document Vault** — upload project documents (blueprints, layouts,
  contracts, invoices, change orders, permits, photos, and more) to Firebase
  Storage with a Firestore record per file. Files can be tagged and optionally
  attached to a trade, phase, contractor, or punch item. The vault offers
  text search (name + tags) and project / type / trade / pinned filters, with
  pinned items sorted first. The upload form auto-fills the name and infers the
  document type from the file, and shows a live upload progress bar (uploads
  are capped at 25 MB).
- ✅ **Pinned blueprints & layouts** — blueprints and layouts can be pinned so
  the current plans are one tap away. Pinned plans surface in a dedicated vault
  section, on the relevant project's detail page, and on the dashboard.
- ✅ **Documents on the phase page** — each trade phase detail page lists the
  documents attached to that phase and lets the GC upload a new one inline
  (pre-scoped to that project + phase).
- ✅ **Schedule confirmation flow** — the GC requests a contractor confirm a
  scheduled date; the contractor opens a tokenized link on their phone (no
  account needed) and confirms or declines with a reason. The phase records the
  confirmation status and note. `validateActionLink()` centralizes the link
  security checks (existence, revoked, expired, used, entity-match) with clear
  per-reason error screens, and Firestore rules allow a token `get` but restrict
  listing and writes.
- ✅ **Internal notification records** — workflow events still write a Firestore
  notification record (visible on the Notifications screen, which is kept on
  disk for dev/testing). **No email/SMS/push is sent.**
- ✅ **Updated Storage rules** + updated seed data covering all of the above.

> #### Scope-tightened for the GC MVP (disabled, code preserved)
>
> The following were scaffolded but are **intentionally turned off** in the
> current build because the GC does not need automated messaging or a
> contractor self-service portal yet. The code is preserved (marked
> `// FUTURE FEATURE:`) so it can be re-enabled later:
>
> - **Automated messaging** — real email/SMS/push delivery. `dispatchNotification`
>   now only records a notification; the email/SMS “prepare” helpers are kept but
>   not called. The dashboard messaging/notification cards and the Notifications
>   nav entry are removed.
> - **Contractor portal beyond schedule confirmation** — the punch-item update
>   link flow (`PunchItemUpdateAction`, `PunchItemLinkButton`) is disabled; punch
>   items are managed by the GC only. Contractor notes already in the data still
>   display read-only.
> - **Extra action-link types** — only `Schedule Confirmation` is active.
>   `Completion Submission`, `Punch Item Update`, and `Document Request` remain in
>   the type union and helpers but are commented out of `ACTION_LINK_TYPES`.

### What's **not** included in Sprint 3

- Document versioning, preview/annotation, or markup
- Per-project / per-role data restrictions (rules are still permissive beyond
  the action-link token check)

---

## Intentionally **not** included yet

To keep the current scope focused, these are deliberately left out:

- Payment processing and accounting integrations
- Bid comparison / bidding tools
- Native mobile apps
- AI features
- Blueprint markup / document annotation
- Full SMS automation (real outbound SMS/email delivery)
- Complex / advanced calendar scheduling (Gantt, dependencies, critical path)
- Procore-style enterprise per-project / per-role permissions (rules are
  permissive for now)

## Planned next

Recommended focus areas for a future sprint:

- **Real notification delivery** — wire the prepared email/SMS deliveries to a
  provider (e.g. Firebase Cloud Functions + SendGrid/Twilio) and add a
  per-user inbox with unread counts.
- **Project-scoped security rules** — per-project membership and role checks in
  both Firestore and Storage rules, replacing the permissive MVP rules.
- **Punch item photos** — let contractors attach before/after photos to punch
  items, reusing the completion-photo upload pattern.
- **Document previews** — in-app previews/thumbnails and versioning for vault
  documents.
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
