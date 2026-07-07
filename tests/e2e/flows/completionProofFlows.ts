import { type TestInfo } from "@playwright/test";
import { type PhaseBinderApp } from "../fixtures";
import { captureMilestone } from "../helpers/screenshots";
import { uniqueName } from "../helpers/testData";

/**
 * QA flow: a GC reviews submitted completion proof and approves it, advancing
 * the phase from In Progress → Submitted Complete → Approved.
 */
export async function runGcApprovesCompletionProofTest(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, tradePhases, phaseDetail, page } = app;

  await loginPage.signInAsGc();

  const phaseTitle = uniqueName("Completion approve phase");

  await tradePhases.createPhase({ title: phaseTitle, status: "In Progress" });
  await captureMilestone(page, testInfo, "Phase in progress");

  // Contractor submits proof; the phase advances to Submitted Complete.
  await phaseDetail.submitCompletionProof(
    "Drywall hung and finished in units 101–104.",
  );
  await phaseDetail.expectStatus("Submitted Complete");
  await captureMilestone(page, testInfo, "Completion submitted");

  // GC reviews and approves; the phase is Approved.
  await phaseDetail.approveCompletion();
  await phaseDetail.expectStatus("Approved");
  await captureMilestone(page, testInfo, "Completion approved");
}

/**
 * QA flow: a GC sends submitted completion proof back for rework, returning the
 * phase to In Progress with the reviewer's feedback recorded.
 */
export async function runGcSendsBackCompletionProofForFixesTest(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, tradePhases, phaseDetail, page } = app;

  await loginPage.signInAsGc();

  const phaseTitle = uniqueName("Completion reject phase");

  await tradePhases.createPhase({ title: phaseTitle, status: "In Progress" });

  await phaseDetail.submitCompletionProof("Paint finished throughout.");
  await phaseDetail.expectStatus("Submitted Complete");
  await captureMilestone(page, testInfo, "Completion submitted");

  // GC rejects with feedback; the phase goes back to In Progress for rework.
  await phaseDetail.rejectCompletion(
    "Touch-ups needed around window trim in unit 102.",
  );
  await phaseDetail.expectStatus("In Progress");
  await captureMilestone(page, testInfo, "Completion sent back");
}
