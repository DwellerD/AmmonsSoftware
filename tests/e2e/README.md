# PhaseBinder end-to-end tests (Playwright)

End-to-end tests that drive the real app against the live Firebase project and
capture labelled screenshots at each milestone — handy for a QA dashboard.

## Latest verified run

- Full suite status: 15 passed, 1 skipped.
- Skipped case: contractor role restriction remains intentionally `test.fixme`
  until a contractor portal exists.
- Validation date: 2026-07-21.

## What is covered

| Spec | Scenario |
| --- | --- |
| `material-delay-blocks-phase.spec.ts` | A material delay blocks a trade phase and surfaces on the dashboard + activity log |
| `material-receipt-verification.spec.ts` | One-time receipt link → anonymous photo proof → GC verification |
| `completion-proof-inspection.spec.ts` | Completion proof submitted → approved, plus the rejection (rework) path |
| `document-vault-blueprint.spec.ts` | Upload, pin, and find a blueprint (vault top section, tag search, dashboard) |
| `punch-item-lifecycle.spec.ts` | Create → assign → filter → Open → In Progress → Resolved, with open-count + activity checks |
| `role-access-control.spec.ts` | Signed-out routes redirect to login; GC reaches every screen (contractor blocking is a documented pending feature) |
| `settings-and-automation.spec.ts` | Settings profile save, dark-mode persistence/neutral material rows, and automatic Needs Inspection transition |
| `data-integrity-and-isolation.spec.ts` | Profile data isolation across accounts and owner-only project visibility/persistence across account switching |
| `project-sharing-and-invites.spec.ts` | Revoke dialog supports live access edits/removal, and invitees can accept or reject with owner-visible status updates |

## Why the spec files are intentionally thin

A spec file is a **test catalog**: it names the QA scenario and hands off to a
named flow. Nothing else. Specs contain no assertions, no selectors, no page
actions, no test data, no waits, and no cleanup. A reviewer can read the
`*.spec.ts` files and immediately see *what* is validated without wading through
*how*.

```ts
test.describe("Material delay blocks a trade phase", () => {
  test("GC sees a delayed material block a phase and surface across the app",
    ({ app }, testInfo) => runMaterialDelayBlocksPhaseTest(app, testInfo));
});
```

## Where the actual test logic lives

The suite is layered so each concern has one home:

| Layer | Folder | Responsibility |
| --- | --- | --- |
| **Specs** | `tests/e2e/*.spec.ts` | Name scenarios; call one flow each. No logic. |
| **Flows** | `tests/e2e/flows/` | The QA workflow: ordered business steps, sign-in, test data, milestone screenshots. Named for intent (`runMaterialDelayBlocksPhaseTest`, …). |
| **Page objects** | `tests/e2e/pages/` | Browser interactions and **web-first `expect`** assertions, encapsulated behind intent-named methods (`expectStatus`, `expectMaterialDelayed`, …). |
| **Fixtures** | `tests/e2e/fixtures.ts` | A single aggregate `app` fixture bundles every page object, so specs declare one dependency. |
| **Helpers** | `tests/e2e/helpers/` | Unique test data, milestone screenshots, env loading, and a Firestore write-settle helper. |

## Design notes (QA conventions used here)

- **Thin specs over a flow + Page Object Model.** Assertions and browser actions
  never appear in a spec — they live in flows (the workflow) and page objects
  (the interactions/assertions).
- **Independent, re-runnable tests.** Each flow creates the data it needs with a
  unique run id (`helpers/testData.ts`) instead of depending on a fixed seed row,
  so reruns never collide. Activity-feed assertions are scoped to those unique
  names so they stay deterministic as the shared log accumulates.
- **Resilient locators.** The app ships no `data-testid`s, so tests use
  role/label/text locators — Playwright's recommended, user-facing approach.
- **No hard-coded waits.** Waiting is done with Playwright's web-first
  assertions and a write-settle helper (`helpers/firestore.ts`) that waits for
  Firestore to acknowledge optimistic writes before navigating — never
  `waitForTimeout` in a flow or spec.
- **Fresh sign-in per test.** Firebase persists its session in IndexedDB, which
  saved storage state does not carry between browser contexts, so each flow logs
  in through the UI.
- **Honest scope.** Role-based blocking of a contractor account is marked
  `test.fixme` because the current MVP is intentionally GC-only. The control is
  documented for when the contractor portal ships.


## Prerequisites

1. **Install browsers** (once):
   ```bash
   npx playwright install chromium
   ```
2. **A test GC account.** Create a Firebase user (sign-up screen or Auth console)
   with the GC role.
3. **Seed demo data** so a project + trades exist for new phases/documents:
   ```bash
   npm run seed
   ```
4. **Configure credentials.** Copy the example env and fill it in:
   ```bash
   cp tests/e2e/.env.example tests/e2e/.env
   # then set E2E_GC_EMAIL and E2E_GC_PASSWORD
   ```
   `tests/e2e/.env` is git-ignored — credentials never get committed.

> The app itself still needs its `.env.local` Firebase config, and the Firestore
> + Storage rules must be deployed (`npx firebase deploy --only firestore:rules`
> and `--only storage`).

## Running

```bash
npm run test:e2e          # run everything (boots `npm run dev` automatically)
npm run test:e2e:ui       # interactive UI mode
npm run test:e2e:report   # open the HTML report after a run
```

Run a single spec or open headed/debug mode:

```bash
npx playwright test material-delay-blocks-phase.spec.ts
npx playwright test --headed
npx playwright test --debug
```

## Screenshots for the dashboard

Each test calls `captureMilestone(...)` at key points. The images are:

- saved to `test-results/<spec>/.../screenshots/NN-label.png`, and
- attached inline to the HTML report (`playwright-report/`).

`screenshot: "on"` in `playwright.config.ts` also records an end-of-test
screenshot for every test, and traces/videos are retained on failure.

## Limitations & not-yet-implemented flows

- **Contractor portal / role-based blocking** — not built yet. The MVP is
  GC-only, so the "contractor cannot reach GC screens" check is `test.fixme`
  (no fake pass). Enable it once the portal ships by adding
  `E2E_CONTRACTOR_EMAIL` / `E2E_CONTRACTOR_PASSWORD` and implementing the flow.
- **Single role** — there is no separate customer/stylist/admin-style dashboard;
  the app has one GC workspace, so role-switching scenarios beyond signed-out vs.
  signed-in GC do not apply.
- **Shared live backend** — tests run serially (`workers: 1`) against the real
  Firebase project and create data tagged `[e2e-…]`. There is no automated
  teardown; the unique tags keep runs from colliding, but the data persists.
- **Seed dependency** — flows that create phases/documents need the demo project
  and at least one trade + contractor to exist (`npm run seed`).
