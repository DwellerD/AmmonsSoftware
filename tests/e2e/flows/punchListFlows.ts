import { type TestInfo } from "@playwright/test";
import { type PhaseBinderApp } from "../fixtures";
import { captureMilestone } from "../helpers/screenshots";
import { uniqueName, futureIso, escapeRegExp } from "../helpers/testData";

/**
 * QA flow: the full punch-item lifecycle — a GC creates an assigned, prioritised
 * punch item, finds and filters it on the cross-project Punch List, walks it
 * Open → In Progress → Resolved, and sees the open count and activity feed keep
 * up.
 */
export async function runPunchItemLifecycleTest(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, tradePhases, phaseDetail, punchList, dashboard, page } =
    app;

  await loginPage.signInAsGc();

  const phaseTitle = uniqueName("Punch lifecycle phase");
  const punchTitle = uniqueName("Touch up paint in unit 104");

  await tradePhases.createPhase({ title: phaseTitle, status: "In Progress" });

  // Create the punch item: assigned, high priority, with a due date.
  await phaseDetail.addPunchItem({
    title: punchTitle,
    description: "Scuffed drywall corner needs repaint.",
    priority: "High",
    dueDate: futureIso(3),
    assignContractor: true,
  });
  await phaseDetail.expectOpenPunchCount(1);
  await captureMilestone(page, testInfo, "Punch item created");

  // Start the work; an in-progress item still counts as open.
  await phaseDetail.setPunchStatus(punchTitle, "In Progress");
  await phaseDetail.expectOpenPunchCount(1);
  await captureMilestone(page, testInfo, "Punch item in progress");

  // It appears on the cross-project Punch List and filters by status.
  await punchList.goto();
  await punchList.expectItemVisible(punchTitle);
  await punchList.filterByStatus("Resolved");
  await punchList.expectItemHidden(punchTitle);
  await punchList.filterByStatus("In Progress");
  await punchList.expectItemVisible(punchTitle);
  await captureMilestone(page, testInfo, "Filtered punch list");

  // Resolve it back on the phase; the open count drops to zero.
  await tradePhases.openPhaseByTitle(phaseTitle);
  await phaseDetail.setPunchStatus(punchTitle, "Resolved");
  await phaseDetail.expectOpenPunchCount(0);
  await captureMilestone(page, testInfo, "Punch item resolved");

  // The resolution is captured in the dashboard activity feed.
  await dashboard.goto();
  await dashboard.expectRecentActivity(
    new RegExp(`Punch item resolved.*${escapeRegExp(punchTitle)}`),
  );
  await captureMilestone(page, testInfo, "Activity log records resolution");
}
