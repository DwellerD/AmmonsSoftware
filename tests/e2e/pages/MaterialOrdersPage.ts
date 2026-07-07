import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for the Material tracking list (`/material-orders`).
 *
 * Unlike the dashboard's "Delayed materials" card — which only surfaces the
 * top few orders — this screen lists every material order with a status filter,
 * so it is the reliable place to confirm an order's state propagated app-wide.
 * Each order renders as a row carrying its name and a status badge.
 */
export class MaterialOrdersPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/material-orders");
    await expect(
      this.page.getByRole("heading", { name: "Material tracking", level: 1 }),
    ).toBeVisible();
  }

  /** Narrow the list to a single status. */
  async filterByStatus(status: string): Promise<void> {
    await this.page
      .getByLabel("Filter by status")
      .selectOption({ label: status });
  }

  /**
   * Confirm a material order shows up as Delayed: filter the list to Delayed
   * orders and assert the named order is present with the Delayed badge.
   */
  async expectMaterialDelayed(name: string): Promise<void> {
    await this.filterByStatus("Delayed");
    const row = this.row(name);
    await expect(row).toBeVisible();
    await expect(row.getByText("Delayed", { exact: true })).toBeVisible();
  }

  /**
   * In dark mode, delayed/received rows should not use tinted backgrounds.
   */
  async expectRowNeutralInDarkMode(status: "Delayed" | "Received"): Promise<void> {
    const row = this.page
      .locator("li")
      .filter({ has: this.page.getByText(status, { exact: true }) })
      .first();
    await expect(row).toBeVisible();

    const className = (await row.getAttribute("class")) ?? "";
    expect(className).not.toContain("bg-amber-50");
    expect(className).not.toContain("bg-green-50");
    expect(className).not.toContain("border-amber-400");
    expect(className).not.toContain("border-green-400");
  }

  private row(name: string): Locator {
    return this.page.locator("li").filter({ hasText: name });
  }
}
