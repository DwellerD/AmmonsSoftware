import { test } from "./fixtures";
import {
  runGcApprovesCompletionProofTest,
  runGcSendsBackCompletionProofForFixesTest,
} from "./flows/completionProofFlows";

/**
 * Scenario 2 — Completion proof and inspection workflow.
 *
 * The spec only names the QA scenarios and delegates to flows; all browser
 * actions, assertions, and test data live in `flows/completionProofFlows.ts`.
 * Both the approval and the rejection (rework) paths are covered.
 */
test.describe("Completion proof and inspection workflow", () => {
  test("GC approves submitted completion proof", ({ app }, testInfo) =>
    runGcApprovesCompletionProofTest(app, testInfo));

  test("GC sends back completion proof that needs fixes", ({ app }, testInfo) =>
    runGcSendsBackCompletionProofForFixesTest(app, testInfo));
});

