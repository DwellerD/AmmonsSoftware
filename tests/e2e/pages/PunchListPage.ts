import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for the cross-project Punch list screen (`/punch-items`).
 *
 * Filters are exposed as accessible-name `<select>`s, and every assertion is
 * scoped to the punch item's row so it is unambiguous.
 */
export class PunchListPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/punch-items");
    await expect(
      this.page.getByRole("heading", { name: "Punch list", level: 1 }),
    ).toBeVisible();
  }

  /** Narrow the list to a single status. */
  async filterByStatus(status: string): Promise<void> {
    await this.page.getByLabel("Filter by status").selectOption({ label: status });
  }

  /** Clear the status filter back to all statuses. */
  async clearStatusFilter(): Promise<void> {
    await this.page.getByLabel("Filter by status").selectOption({ label: "All statuses" });
  }

  /** Confirm a punch item is present in the list. */
  async expectItemVisible(title: string): Promise<void> {
    await expect(this.row(title)).toBeVisible();
  }

  /** Confirm a punch item is absent from the current (filtered) list. */
  async expectItemHidden(title: string): Promise<void> {
    await expect(this.row(title)).toHaveCount(0);
  }

  /** Confirm the header reports the expected number of open items. */
  async expectOpenCount(count: number): Promise<void> {
    await expect(
      this.page.getByText(new RegExp(`\\b${count} open\\b`)),
    ).toBeVisible();
  }

  private row(title: string): Locator {
    return this.page.locator("li").filter({ hasText: title });
  }
}
