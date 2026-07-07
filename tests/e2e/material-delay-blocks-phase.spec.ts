import { test } from "./fixtures";
import { runMaterialDelayBlocksPhaseTest } from "./flows/materialDelayFlows";

/**
 * Scenario 1 — A material delay blocks a trade phase.
 *
 * The spec only names the QA scenario and delegates to a flow; all browser
 * actions, assertions, and test data live in `flows/materialDelayFlows.ts`.
 */
test.describe("Material delay blocks a trade phase", () => {
  test("GC sees a delayed material block a phase and surface across the app", ({ app }, testInfo) =>
    runMaterialDelayBlocksPhaseTest(app, testInfo));
});

