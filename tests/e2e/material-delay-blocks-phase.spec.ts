import { test } from "./fixtures";
import { runMaterialDelayBlocksPhaseTest } from "./flows/materialDelayFlows";

/**
 * Scenario 1 — A material delay blocks a trade phase.
 */
test.describe("Material delay blocks a trade phase", () => {
  test("GC sees a delayed material block a phase and surface across the app", ({ app }, testInfo) =>
    runMaterialDelayBlocksPhaseTest(app, testInfo));
});

