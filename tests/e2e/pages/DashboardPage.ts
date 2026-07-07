import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for the GC daily dashboard (`/dashboard`).
 *
 * The dashboard is built from "attention cards" (each an `<h3>` title over a
 * list) plus a recent-activity feed. Assertions are scoped to the relevant card
 * so an item only counts if it appears where the GC expects it.
 */
export class DashboardPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/dashboard");
    await expect(
      this.page.getByRole("heading", { name: "Dashboard", level: 1 }),
    ).toBeVisible();
  }

  /** Confirm a pinned document surfaces in the "Pinned documents" card. */
  async expectPinnedDocument(name: string): Promise<void> {
    await this.expectInCard("Pinned documents", name);
  }

  /** Confirm the recent-activity feed contains an entry matching the text. */
  async expectRecentActivity(text: string | RegExp): Promise<void> {
    await this.expectInCard("Recent activity", text);
  }

  /**
   * Assert a card eventually shows the given text. The dashboard fetches its
   * rollups once on mount, while the writes that feed them (activity log,
   * material status) commit asynchronously behind an optimistic UI. Reloading
   * between attempts re-queries Firestore so the assertion tolerates that
   * eventual consistency instead of racing the write.
   */
  private async expectInCard(
    title: string,
    text: string | RegExp,
  ): Promise<void> {
    await expect(async () => {
      await this.page.reload();
      await expect(
        this.page.getByRole("heading", { name: "Dashboard", level: 1 }),
      ).toBeVisible();
      await expect(
        this.card(title).getByText(text).first(),
      ).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 25_000 });
  }

  /** Locate a dashboard card by its title heading. */
  private card(title: string): Locator {
    return this.page
      .locator("div.rounded-xl")
      .filter({
        has: this.page.getByRole("heading", { name: title, exact: true }),
      });
  }
}
