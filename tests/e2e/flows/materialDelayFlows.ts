import { type TestInfo } from "@playwright/test";
import { type PhaseBinderApp } from "../fixtures";
import { captureMilestone } from "../helpers/screenshots";
import { uniqueName, futureIso, escapeRegExp } from "../helpers/testData";

/**
 * QA flow: a supplier delay on a tracked material should block the trade phase
 * and be visible everywhere the GC looks — the phase status, the material
 * tracking list, and the dashboard activity feed.
 */
export async function runMaterialDelayBlocksPhaseTest(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, tradePhases, phaseDetail, materialOrders, dashboard, page } =
    app;

  await loginPage.signInAsGc();

  const phaseTitle = uniqueName("Material delay phase");
  const materialName = uniqueName("Roof trusses");

  // GC opens a phase that is waiting on materials.
  await tradePhases.createPhase({
    title: phaseTitle,
    status: "Materials Pending",
  });
  await captureMilestone(page, testInfo, "Phase awaiting materials");

  // Track the material order against the phase.
  await phaseDetail.addMaterialOrder({
    name: materialName,
    supplier: "Northwest Lumber",
    status: "Ordered",
    expectedArrival: futureIso(5),
  });
  await captureMilestone(page, testInfo, "Material order tracked");

  // The supplier slips: mark it Delayed and block the phase on the delay.
  await phaseDetail.setMaterialStatus(materialName, "Delayed");
  await phaseDetail.expectMaterialsDelayed();
  await phaseDetail.blockPhaseForDelay();
  await phaseDetail.expectStatus("Blocked");
  await captureMilestone(page, testInfo, "Phase blocked on delay");

  // The delay should propagate to the cross-project material tracking list.
  await materialOrders.goto();
  await materialOrders.expectMaterialDelayed(materialName);
  await captureMilestone(page, testInfo, "Material list shows the delay");

  // ...and the dashboard activity feed should record the delay and the block.
  await dashboard.goto();
  await dashboard.expectRecentActivity(
    new RegExp(`${escapeRegExp(phaseTitle)}.*Blocked`),
  );
  await dashboard.expectRecentActivity(
    new RegExp(`${escapeRegExp(materialName)}.*Delayed`),
  );
  await captureMilestone(page, testInfo, "Dashboard surfaces the delay");
}
