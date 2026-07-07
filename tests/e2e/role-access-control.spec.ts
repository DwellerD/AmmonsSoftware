import { test } from "./fixtures";
import {
  runUnauthenticatedUserIsRedirectedToLoginTest,
  runSignedInGcCanReachEveryScreenTest,
} from "./flows/roleAccessFlows";

/**
 * Scenario 5 — Role and protected-route access control.
 *
 * The spec only names the QA scenarios and delegates to flows; all browser
 * actions and assertions live in `flows/roleAccessFlows.ts`.
 *
 * Role-based blocking of a limited "contractor" user is a pending feature: the
 * current MVP is intentionally GC-only (no contractor portal yet), so that case
 * is marked `fixme` rather than asserted against behaviour the app does not
 * implement. That keeps the suite honest while recording the intended control
 * for when the portal ships.
 */
test.describe("Role and protected-route access control", () => {
  test("signed-out visitors are redirected to login", ({ app }, testInfo) =>
    runUnauthenticatedUserIsRedirectedToLoginTest(app, testInfo));

  test("signed-in GC can reach every workspace screen", ({ app }, testInfo) =>
    runSignedInGcCanReachEveryScreenTest(app, testInfo));

  // Pending the contractor portal (see file header). When that ships, a limited
  // contractor account should be blocked from management screens and from the
  // Document Vault / contracts / invoices. Provide E2E_CONTRACTOR_EMAIL and
  // E2E_CONTRACTOR_PASSWORD, then implement the flow and remove this `fixme`.
  test.fixme(
    "contractor cannot reach GC management screens or the Document Vault",
    () => {
      // Intentionally empty until role-based route protection exists.
    },
  );
});

