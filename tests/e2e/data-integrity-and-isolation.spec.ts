import { test } from "./fixtures";
import {
  runProfileDataIsolationAndPersistenceTest,
  runProjectOwnershipIsolationTest,
} from "./flows/dataIntegrityFlows";

/**
 * Scenario 7 — Data integrity and account isolation.
 */
test.describe("Data integrity and account isolation", () => {
  test("profile data stays isolated per account and persists", ({ app }, testInfo) =>
    runProfileDataIsolationAndPersistenceTest(app, testInfo));

  test("project data stays private per owner and persists", ({ app }, testInfo) =>
    runProjectOwnershipIsolationTest(app, testInfo));
});
