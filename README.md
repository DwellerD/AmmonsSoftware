# TradeFlow

> Mobile-first construction workflow app for general contractors and site
> supervisors.

TradeFlow helps a GC manage **trade readiness, material tracking, contractor
scheduling, completion proof, inspections, documents, and daily project
visibility** — all from their phone or desktop.

This repository contains the **Sprint 1 foundation** build.

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
- **Firebase** — **Authentication** (email/password) + **Cloud Firestore**

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
  components/
    ui/                      Reusable UI primitives (Button, Card, Field, …)
    layout/AppShell.tsx      Sidebar + mobile nav
    auth/                    Login form + logout button
    forms/                   Trade phase form
    providers/               AuthProvider (Firebase auth state + role)
  lib/
    firebase/client.ts       Firebase app/Auth/Firestore initialization
    api.ts                   Data-access layer (all Firestore queries live here)
    constants.ts             Roles, statuses, status colors
    database.types.ts        TypeScript types for every collection
    format.ts                Date/time formatting helpers
firestore.rules              Firestore security rules
firestore.indexes.json       Firestore composite index definitions
firebase.json                Firebase CLI config (Firestore rules + indexes)
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
4. **Project settings → General → Your apps → Web app** (`</>`). Register a web
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

### 5. Deploy Firestore security rules

The repo ships with `firestore.rules`. Deploy them with the Firebase CLI:

```bash
npx firebase deploy --only firestore:rules
```

(`npx firebase login` first if you haven't authenticated the CLI.)

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
trade phases in various statuses so the dashboard looks realistic. The seeder is
**safe**: it refuses to run in production and skips entirely if the demo project
already exists.

---

## How Firebase is used

- **Auth** — email/password sign-in via Firebase Authentication. The login form
  creates the account and writes a `users/{uid}` profile document (with a
  default role). `AuthProvider` exposes the current user + role to the app via
  the `useAuth()` hook.
- **Firestore** — a NoSQL document store holds `projects`, `contractors`,
  `trades`, `tradePhases`, `activityLogs`, and `users`. Firestore has no joins,
  so the data layer (`src/lib/api.ts`) loads related collections and stitches
  names together in memory.
- **Security rules** — `firestore.rules` restricts all collections to
  signed-in users (with users only able to write their own profile, and an
  append-only activity log). Project-scoped restrictions are planned for a later
  sprint.
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

## Intentionally **not** included yet

To keep Sprint 1 focused, these are deliberately left out:

- Payment processing and accounting integrations
- Bid comparison / bidding tools
- Native mobile apps
- AI features
- Blueprint markup
- Complex scheduling (Gantt, dependencies, critical path)
- Per-project / per-role data restrictions (rules are permissive for now)

## Planned next: Sprint 2

The trade phase detail page already reserves space for these:

- **Materials** tracking (orders, arrivals, blockers)
- **Completion photos** (photo proof of finished work) via Firebase Storage
- **Inspection notes** (results and follow-ups)
- **Documents** (drawings, contracts, change orders) via Firebase Storage
- Notifications (email / SMS)
- Tighter, project-scoped security rules

---

## Deployment

The app is a standard Next.js build and can be hosted on any platform that runs
Next.js. **Firebase App Hosting** is a natural fit since the backend already
lives in Firebase, but Vercel or any Node host works too.

1. Push this repository to your Git provider.
2. Import it into your host (Firebase App Hosting, Vercel, etc.).
3. Add the `NEXT_PUBLIC_FIREBASE_*` environment variables from the table above
   in the host's project settings.
4. Make sure your Firestore security rules are deployed:

   ```bash
   npx firebase deploy --only firestore:rules
   ```

5. Deploy. The production build is verified with:

   ```bash
   npm run build
   ```
