import { type TestInfo } from "@playwright/test";
import { type PhaseBinderApp } from "../fixtures";
import { captureMilestone } from "../helpers/screenshots";
import { uniqueName } from "../helpers/testData";

function pastIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/**
 * QA flow: settings profile updates persist after reload.
 */
export async function runSettingsProfileSaveTest(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, nav, settings, page } = app;

  await loginPage.signInAsGc();
  await nav.goTo("Settings");

  const fullName = uniqueName("GC Settings");
  await settings.saveFullName(fullName);
  await captureMilestone(page, testInfo, "Settings profile saved");

  await page.reload();
  await settings.expectFullName(fullName);
  await captureMilestone(page, testInfo, "Settings profile persists");
}

/**
 * QA flow: dark theme toggle persists and material rows stay neutral in dark mode.
 */
export async function runDarkModePersistenceAndNeutralRowsTest(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, nav, settings, materialOrders, page } = app;

  await loginPage.signInAsGc();
  await nav.goTo("Settings");
  await settings.setTheme("Dark");
  await settings.expectStoredTheme("dark");
  await settings.expectDarkModeEnabled();
  await captureMilestone(page, testInfo, "Dark mode enabled");

  await nav.goTo("Materials");
  await materialOrders.expectRowNeutralInDarkMode("Delayed");
  await captureMilestone(page, testInfo, "Materials neutral rows in dark mode");

  await page.reload();
  await settings.expectDarkModeEnabled();
  await captureMilestone(page, testInfo, "Dark mode persists after reload");
}

/**
 * QA flow: overdue scheduled phases auto-transition to Needs Inspection.
 */
export async function runAutomaticNeedsInspectionTransitionTest(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, tradePhases, phaseDetail, page } = app;

  await loginPage.signInAsGc();

  const phaseTitle = uniqueName("Auto inspect phase");
  await tradePhases.createPhase({
    title: phaseTitle,
    status: "Scheduled",
    scheduledStartDate: pastIso(4),
    scheduledEndDate: pastIso(1),
  });

  await phaseDetail.expectStatus("Needs Inspection");
  await captureMilestone(page, testInfo, "Phase auto-transitioned to inspection");
}
