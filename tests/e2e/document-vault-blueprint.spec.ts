import { test } from "./fixtures";
import { runPinnedBlueprintIsEasyToFindTest } from "./flows/documentVaultFlows";

/**
 * Scenario 3 — Document Vault blueprint workflow.
 */
test.describe("Document Vault blueprint workflow", () => {
  test("a pinned blueprint is easy to find across the app", ({ app }, testInfo) =>
    runPinnedBlueprintIsEasyToFindTest(app, testInfo));
});

