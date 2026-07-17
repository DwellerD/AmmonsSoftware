import { type TestInfo } from "@playwright/test";
import { type PhaseBinderApp } from "../fixtures";
import { requireEnv } from "../helpers/env";
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
 * QA flow: invitee signs up from invite link, accepts access, owner edits
 * permissions via modal, then removes the member and access disappears.
 */
export async function runInviteAcceptEditAndRemoveFlow(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, nav, projects, projectDetail, invitePage, page } = app;

  const gcEmail = requireEnv("E2E_GC_EMAIL");
  const projectName = uniqueName("Project sharing access");
  const invitee = buildSecondaryAccount("Accepted invite user");

  await loginPage.signInAsGc();
  await projects.createProject(projectName);
  await projects.openProject(projectName);
  await projectDetail.expectLoaded(projectName);
  await projectDetail.expectOwnerWorkspaceTabs();
  await projectDetail.expectPunchListKeepsProjectContext();
  await page.goBack();
  await projectDetail.expectLoaded(projectName);
  const projectDetailUrl = page.url();

  const inviteUrl = await projectDetail.createInvite(
    invitee.email,
    "Join this project and review field activity.",
  );
  await captureMilestone(page, testInfo, "Owner created share invite");

  await nav.signOut();

  await loginPage.signInAsGc();
  await invitePage.goto(inviteUrl);
  await invitePage.expectInviteDetails(projectName, gcEmail);
  await invitePage.expectWrongAccount(gcEmail, invitee.email);
  await invitePage.expectCannotAcceptOrReject();
  await captureMilestone(page, testInfo, "Wrong-account guard shown with switch-account action");

  await invitePage.clickSwitchAccount();
  await loginPage.signUp(invitee.fullName, invitee.email, invitee.password, {
    expectedUrl: /\/invite\//,
    expectedHeading: null,
  });

  await invitePage.expectInviteDetails(projectName, gcEmail);
  await invitePage.acceptInvite();
  await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 30_000 });
  await projectDetail.expectDefaultMemberWorkspaceTabs();
  await projectDetail.expectManageUsersHidden();
  await captureMilestone(page, testInfo, "Invitee accepted and opened project");

  await page.goto("/projects");
  await nav.signOut();

  await loginPage.signInAsGc();
  await projects.openProject(projectName);
  await projectDetail.expectMemberVisible(invitee.email);

  await projectDetail.openMemberManageDialog(invitee.email);
  await projectDetail.setDialogPermission("View material orders", true);
  await projectDetail.saveDialogAccess();
  await captureMilestone(page, testInfo, "Owner edited member access from edit modal");

  await nav.signOut();

  await loginPage.signIn(invitee.email, invitee.password);
  await projects.expectProjectVisible(projectName);
  await projects.openProject(projectName);
  await projectDetail.expectMaterialMemberWorkspaceTabs();
  await projectDetail.expectManageUsersHidden();
  await captureMilestone(page, testInfo, "Invitee sees only newly granted project workspace tab");

  await nav.signOut();

  await loginPage.signInAsGc();
  await projects.openProject(projectName);

  await projectDetail.openMemberManageDialog(invitee.email);
  await projectDetail.revokeAllAccessFromDialog();
  await projectDetail.expectMemberHidden(invitee.email);
  await captureMilestone(page, testInfo, "Owner revoked all member access from edit modal");

  await nav.signOut();

  await loginPage.signIn(invitee.email, invitee.password);
  await projects.expectProjectHidden(projectName);
  await page.goto(projectDetailUrl);
  await expectNoProjectAccess(page);
  await captureMilestone(page, testInfo, "Removed member no longer sees or opens project");
}

/**
 * QA flow: invitee can reject from invite screen after sign-up, owner sees
 * rejected status and no project membership is granted.
 */
export async function runInviteRejectFlow(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, nav, projects, projectDetail, invitePage, page } = app;

  const gcEmail = requireEnv("E2E_GC_EMAIL");
  const projectName = uniqueName("Project invite rejection");
  const invitee = buildSecondaryAccount("Rejected invite user");

  await loginPage.signInAsGc();
  await projects.createProject(projectName);
  await projects.openProject(projectName);
  await projectDetail.expectLoaded(projectName);

  const inviteUrl = await projectDetail.createInvite(
    invitee.email,
    "Review this project invite and respond.",
  );
  await captureMilestone(page, testInfo, "Owner created invite for rejection path");

  await nav.signOut();

  await invitePage.goto(inviteUrl);
  await invitePage.expectInviteDetails(projectName, gcEmail);
  await invitePage.expectSignedOutPrompt(invitee.email);
  await invitePage.clickSignInOrCreate();

  await loginPage.signUp(invitee.fullName, invitee.email, invitee.password, {
    expectedUrl: /\/invite\//,
    expectedHeading: null,
  });

  await invitePage.expectInviteDetails(projectName, gcEmail);
  await invitePage.rejectInvite();
  await invitePage.expectInviteDeclined(projectName);
  await captureMilestone(page, testInfo, "Invitee rejected the invite");

  await page.goto("/projects");
  await projects.expectProjectHidden(projectName);
  await nav.signOut();

  await loginPage.signInAsGc();
  await projects.openProject(projectName);
  await projectDetail.expectMemberHidden(invitee.email);
  await captureMilestone(page, testInfo, "Owner confirms rejected invite did not grant member access");
}

async function expectNoProjectAccess(page: PhaseBinderApp["page"]): Promise<void> {
  await page
    .getByText(/Project not found|You do not have permission|Missing or insufficient permissions/i)
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
}
