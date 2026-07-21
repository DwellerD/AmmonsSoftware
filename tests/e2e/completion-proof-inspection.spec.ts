import { test } from "./fixtures";
import {
  runGcApprovesCompletionProofTest,
  runGcSendsBackCompletionProofForFixesTest,
} from "./flows/completionProofFlows";

/**
 * Scenario 2 — Completion proof and inspection workflow.
 */
test.describe("Completion proof and inspection workflow", () => {
  test("GC approves submitted completion proof", ({ app }, testInfo) =>
    runGcApprovesCompletionProofTest(app, testInfo));

  test("GC sends back completion proof that needs fixes", ({ app }, testInfo) =>
    runGcSendsBackCompletionProofForFixesTest(app, testInfo));
});

