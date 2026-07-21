import { test } from "./fixtures";
import { runPunchItemLifecycleTest } from "./flows/punchListFlows";

/**
 * Scenario 4 — Punch item lifecycle.
 */
test.describe("Punch item lifecycle", () => {
  test("GC creates, tracks, filters, and resolves a punch item", ({ app }, testInfo) =>
    runPunchItemLifecycleTest(app, testInfo));
});

