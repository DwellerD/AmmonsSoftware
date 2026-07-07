import { test as base, type Page } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { AppNav } from "./pages/AppNav";
import { DashboardPage } from "./pages/DashboardPage";
import { TradePhasesPage } from "./pages/TradePhasesPage";
import { TradePhaseDetailPage } from "./pages/TradePhaseDetailPage";
import { DocumentVaultPage } from "./pages/DocumentVaultPage";
import { PunchListPage } from "./pages/PunchListPage";
import { MaterialOrdersPage } from "./pages/MaterialOrdersPage";
import { SettingsPage } from "./pages/SettingsPage";

/**
 * Custom fixtures for the suite.
 *
 * Each screen has its own page object, but specs depend on a single aggregate
 * `app` fixture instead of pulling them in one by one. That keeps the spec
 * files thin — a test only declares `{ app }` and hands it to a named flow —
 * while flows under `flows/` reach for whichever page objects they need.
 *
 * Signing in is left to the flows (not an automatic fixture) so the role-access
 * scenarios can also exercise the signed-out path.
 */
interface PhaseBinderFixtures {
  loginPage: LoginPage;
  nav: AppNav;
  dashboard: DashboardPage;
  tradePhases: TradePhasesPage;
  phaseDetail: TradePhaseDetailPage;
  documents: DocumentVaultPage;
  punchList: PunchListPage;
  materialOrders: MaterialOrdersPage;
  settings: SettingsPage;
  app: PhaseBinderApp;
}

/**
 * Everything a flow needs in one bag: the raw `page` (for milestone
 * screenshots) plus every page object. This is the only fixture spec files
 * reference, so adding a new screen never touches a spec.
 */
export interface PhaseBinderApp {
  page: Page;
  loginPage: LoginPage;
  nav: AppNav;
  dashboard: DashboardPage;
  tradePhases: TradePhasesPage;
  phaseDetail: TradePhaseDetailPage;
  documents: DocumentVaultPage;
  punchList: PunchListPage;
  materialOrders: MaterialOrdersPage;
  settings: SettingsPage;
}

export const test = base.extend<PhaseBinderFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  nav: async ({ page }, use) => {
    await use(new AppNav(page));
  },
  dashboard: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  tradePhases: async ({ page }, use) => {
    await use(new TradePhasesPage(page));
  },
  phaseDetail: async ({ page }, use) => {
    await use(new TradePhaseDetailPage(page));
  },
  documents: async ({ page }, use) => {
    await use(new DocumentVaultPage(page));
  },
  punchList: async ({ page }, use) => {
    await use(new PunchListPage(page));
  },
  materialOrders: async ({ page }, use) => {
    await use(new MaterialOrdersPage(page));
  },
  settings: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
  app: async (
    {
      page,
      loginPage,
      nav,
      dashboard,
      tradePhases,
      phaseDetail,
      documents,
      punchList,
      materialOrders,
      settings,
    },
    use,
  ) => {
    await use({
      page,
      loginPage,
      nav,
      dashboard,
      tradePhases,
      phaseDetail,
      documents,
      punchList,
      materialOrders,
      settings,
    });
  },
});

export { expect } from "@playwright/test";
