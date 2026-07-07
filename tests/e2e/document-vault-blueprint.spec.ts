import { test } from "./fixtures";
import { runPinnedBlueprintIsEasyToFindTest } from "./flows/documentVaultFlows";

/**
 * Scenario 3 — Document Vault blueprint workflow.
 *
 * The spec only names the QA scenario and delegates to a flow; all browser
 * actions, assertions, and test data live in `flows/documentVaultFlows.ts`.
 */
test.describe("Document Vault blueprint workflow", () => {
  test("a pinned blueprint is easy to find across the app", ({ app }, testInfo) =>
    runPinnedBlueprintIsEasyToFindTest(app, testInfo));
});

