import { type TestInfo } from "@playwright/test";
import { type PhaseBinderApp } from "../fixtures";
import { captureMilestone } from "../helpers/screenshots";
import { runId, uniqueName } from "../helpers/testData";

function buildSecondaryAccount(label: string): {
  fullName: string;
  email: string;
  password: string;
} {
  const id = runId();
  return {
    fullName: `${label} [e2e-${id}]`,
    email: `phasebinder.e2e.${id}@example.com`,
    password: `PhaseBinder!${id.slice(-6)}`,
  };
}

/**
 * QA flow: one user's profile updates must not affect another signed-in user.
 */
export async function runProfileDataIsolationAndPersistenceTest(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, nav, settings, page } = app;

  await loginPage.signInAsGc();
  await nav.goTo("Settings");
  const gcOriginalName = await settings.readFullName();
  await captureMilestone(page, testInfo, "GC profile baseline captured");

  const secondary = buildSecondaryAccount("Secondary profile");
  await nav.signOut();
  await loginPage.signUp(
    secondary.fullName,
    secondary.email,
    secondary.password,
  );

  await nav.goTo("Settings");
  await settings.expectFullName(secondary.fullName);

  const secondaryUpdatedName = uniqueName("Secondary profile name");
  await settings.saveFullName(secondaryUpdatedName);
  await settings.expectFullName(secondaryUpdatedName);
  await captureMilestone(page, testInfo, "Secondary profile updated");

  await nav.signOut();
  await loginPage.signInAsGc();
  await nav.goTo("Settings");
  await settings.expectFullName(gcOriginalName);
  await captureMilestone(page, testInfo, "GC profile unchanged after secondary updates");
}

/**
 * QA flow: project data created by one account must remain private to that
 * owner unless explicitly shared, and persist for the owner after account
 * switching.
 */
export async function runProjectOwnershipIsolationTest(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, nav, projects, page } = app;

  const isolatedProjectName = uniqueName("Owner isolation project");

  await loginPage.signInAsGc();
  await projects.createProject(isolatedProjectName);
  await captureMilestone(page, testInfo, "Owner created isolated project");

  const secondary = buildSecondaryAccount("Isolation user");
  await nav.signOut();
  await loginPage.signUp(
    secondary.fullName,
    secondary.email,
    secondary.password,
  );

  await projects.expectProjectHidden(isolatedProjectName);
  await projects.expectNoProjectsYet();
  await captureMilestone(page, testInfo, "Secondary account cannot see owner project");

  await nav.signOut();
  await loginPage.signInAsGc();
  await projects.expectProjectVisible(isolatedProjectName);
  await captureMilestone(page, testInfo, "Owner project persists after account switching");
}
