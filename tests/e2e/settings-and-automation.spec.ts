import { test } from "./fixtures";
import {
  runAutomaticNeedsInspectionTransitionTest,
  runDarkModePersistenceAndNeutralRowsTest,
  runSettingsProfileSaveTest,
} from "./flows/settingsAndAutomationFlows";

/**
 * Scenario 6 — Settings and workflow automation coverage.
 */
test.describe("Settings and workflow automation", () => {
  test("GC saves profile settings", ({ app }, testInfo) =>
    runSettingsProfileSaveTest(app, testInfo));

  test("dark mode persists and material rows stay neutral", ({ app }, testInfo) =>
    runDarkModePersistenceAndNeutralRowsTest(app, testInfo));

  test("overdue scheduled phases auto-transition to Needs Inspection", ({ app }, testInfo) =>
    runAutomaticNeedsInspectionTransitionTest(app, testInfo));
});
