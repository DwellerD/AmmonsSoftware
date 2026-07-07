import { type Page, expect } from "@playwright/test";

/** The primary navigation destinations the GC uses every day. */
export const GC_NAV_ITEMS = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Projects", path: "/projects" },
  { name: "Trades", path: "/trades" },
  { name: "Trade Phases", path: "/trade-phases" },
  { name: "Materials", path: "/material-orders" },
  { name: "Punch List", path: "/punch-items" },
  { name: "Document Vault", path: "/documents" },
  { name: "Contractors", path: "/contractors" },
  { name: "Settings", path: "/settings" },
] as const;

/**
 * Page object for the app shell / sidebar navigation that wraps every
 * authenticated screen.
 */
export class AppNav {
  constructor(private readonly page: Page) {}

  /** Click a sidebar link by its visible label and wait for the route. */
  async goTo(name: (typeof GC_NAV_ITEMS)[number]["name"]): Promise<void> {
    const item = GC_NAV_ITEMS.find((i) => i.name === name);
    if (!item) throw new Error(`Unknown nav item: ${name}`);
    await this.page.getByRole("link", { name, exact: true }).first().click();
    await this.page.waitForURL(`**${item.path}`);
  }

  /** Confirm the signed-in user can open every GC workspace screen. */
  async expectFullGcAccess(): Promise<void> {
    for (const item of GC_NAV_ITEMS) {
      await this.page.goto(item.path);
      await expect(this.page).toHaveURL(new RegExp(`${escapeRegExp(item.path)}`));
      // Staying on the route (not bounced to /login) proves access.
      await expect(this.page).not.toHaveURL(/\/login/);
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
