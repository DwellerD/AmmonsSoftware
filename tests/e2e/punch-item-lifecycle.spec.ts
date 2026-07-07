import { test } from "./fixtures";
import { runPunchItemLifecycleTest } from "./flows/punchListFlows";

/**
 * Scenario 4 — Punch item lifecycle.
 *
 * The spec only names the QA scenario and delegates to a flow; all browser
 * actions, assertions, and test data live in `flows/punchListFlows.ts`.
 */
test.describe("Punch item lifecycle", () => {
  test("GC creates, tracks, filters, and resolves a punch item", ({ app }, testInfo) =>
    runPunchItemLifecycleTest(app, testInfo));
});

