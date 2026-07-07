import { type TestInfo } from "@playwright/test";
import { type PhaseBinderApp } from "../fixtures";
import { captureMilestone } from "../helpers/screenshots";
import { uniqueName, runId } from "../helpers/testData";

/**
 * QA flow: a pinned blueprint is easy to find across the app — it headlines the
 * vault's pinned section, is reachable by a tag search, and surfaces on the GC
 * dashboard's pinned-documents card.
 */
export async function runPinnedBlueprintIsEasyToFindTest(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, documents, dashboard, page } = app;

  await loginPage.signInAsGc();

  const blueprintName = uniqueName("Building A foundation plan");
  const tag = `foundation-${runId()}`;

  // Upload and pin the blueprint, tagged to the seeded project.
  await documents.uploadPinnedBlueprint({ name: blueprintName, tags: tag });
  await captureMilestone(page, testInfo, "Blueprint uploaded and pinned");

  // It should headline the vault in the pinned blueprints & layouts section.
  await documents.goto();
  await documents.expectPinnedPlan(blueprintName);
  await captureMilestone(page, testInfo, "Pinned at top of vault");

  // It should be findable by its tag.
  await documents.search(tag);
  await documents.expectDocumentVisible(blueprintName);
  await captureMilestone(page, testInfo, "Found by tag search");

  // And it should surface on the GC dashboard's pinned documents card.
  await dashboard.goto();
  await dashboard.expectPinnedDocument(blueprintName);
  await captureMilestone(page, testInfo, "Pinned on dashboard");
}
