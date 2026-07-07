import { type TestInfo } from "@playwright/test";
import { type PhaseBinderApp } from "../fixtures";
import { captureMilestone } from "../helpers/screenshots";

/** Protected areas that must bounce a signed-out visitor to the login screen. */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/projects",
  "/trade-phases",
  "/material-orders",
  "/punch-items",
  "/documents",
];

/**
 * QA flow: a signed-out visitor is redirected to login for every protected
 * route, so sensitive contracts and project data are never exposed.
 */
export async function runUnauthenticatedUserIsRedirectedToLoginTest(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, page } = app;

  // No sign-in here — we are verifying the guard on the protected area.
  for (const path of PROTECTED_ROUTES) {
    await loginPage.expectRouteRequiresLogin(path);
  }
  await captureMilestone(page, testInfo, "Protected routes require login");
}

/**
 * QA flow: a signed-in GC can reach every workspace screen in the navigation.
 */
export async function runSignedInGcCanReachEveryScreenTest(
  app: PhaseBinderApp,
  testInfo: TestInfo,
): Promise<void> {
  const { loginPage, nav, page } = app;

  await loginPage.signInAsGc();
  await nav.expectFullGcAccess();
  await captureMilestone(page, testInfo, "GC has full workspace access");
}
