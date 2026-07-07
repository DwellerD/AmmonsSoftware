import { type Page, expect } from "@playwright/test";
import { DEMO_PROJECT_NAME } from "../helpers/constants";

/**
 * Page object for the Trade Phases list (`/trade-phases`) and the creation form
 * (`/trade-phases/new`).
 *
 * Specs create their own phase so each run starts from a clean, known state
 * instead of mutating shared seed data.
 */
export class TradePhasesPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/trade-phases");
    await expect(
      this.page.getByRole("heading", { name: "Trade Phases", level: 1 }),
    ).toBeVisible();
  }

  /**
   * Create a trade phase against the seeded demo project's first trade and land
   * on its detail page. Returns the title so the caller can reference it later.
   */
  async createPhase(options: {
    title: string;
    status?: string;
    scheduledStartDate?: string;
    scheduledEndDate?: string;
  }): Promise<string> {
    await this.page.goto("/trade-phases/new");

    await this.selectSeededProject();
    await this.selectFirstTrade();
    await this.page.locator("#title").fill(options.title);
    if (options.status) {
      await this.page.locator("#status").selectOption({ label: options.status });
    }
    if (options.scheduledStartDate) {
      await this.page
        .locator("#scheduled_start_date")
        .fill(options.scheduledStartDate);
    }
    if (options.scheduledEndDate) {
      await this.page.locator("#scheduled_end_date").fill(options.scheduledEndDate);
    }

    await this.page.getByRole("button", { name: "Create trade phase" }).click();
    // On success the form routes to /trade-phases/<id>.
    await this.page.waitForURL(/\/trade-phases\/[^/]+$/);
    await expect(
      this.page.getByRole("heading", { name: options.title, level: 1 }),
    ).toBeVisible();
    return options.title;
  }

  /** Open an existing phase from the list by its title. */
  async openPhaseByTitle(title: string): Promise<void> {
    await this.goto();
    await this.page.getByRole("link", { name: title }).first().click();
    await this.page.waitForURL(/\/trade-phases\/[^/]+$/);
  }

  /** Confirm a phase with the given title and status is listed. */
  async expectPhaseListed(title: string): Promise<void> {
    await this.goto();
    await expect(this.page.getByRole("link", { name: title })).toBeVisible();
  }

  // --- internals -----------------------------------------------------------

  private async selectSeededProject(): Promise<void> {
    const select = this.page.locator("#project_id");
    const demoCount = await select
      .locator("option", { hasText: DEMO_PROJECT_NAME })
      .count();
    if (demoCount > 0) {
      await select.selectOption({ label: DEMO_PROJECT_NAME });
    } else {
      await select.selectOption({ index: 0 });
    }
  }

  private async selectFirstTrade(): Promise<void> {
    const projectSelect = this.page.locator("#project_id");
    const select = this.page.locator("#trade_id");

    let optionCount = await select.locator("option").count();

    // If the chosen project has no trades, try other projects until one does.
    if (optionCount < 2) {
      const projectCount = await projectSelect.locator("option").count();
      for (let i = 0; i < projectCount; i++) {
        await projectSelect.selectOption({ index: i });
        optionCount = await select.locator("option").count();
        if (optionCount >= 2) break;
      }
    }

    if (optionCount < 2) {
      throw new Error(
        "No project with trades is available. Seed data must include at least one trade.",
      );
    }

    await select.selectOption({ index: 1 });
  }
}
