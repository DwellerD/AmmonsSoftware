import { type Page, expect } from "@playwright/test";

/**
 * Page object for the Settings screen (`/settings`).
 */
export class SettingsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/settings");
    await expect(
      this.page.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeVisible();
  }

  async saveFullName(value: string): Promise<void> {
    await this.page.locator("#settings-full-name").fill(value);
    await this.page.getByRole("button", { name: "Save profile" }).click();
    await expect(
      this.page.getByText("Settings saved. Your profile has been updated."),
    ).toBeVisible();
  }

  async expectFullName(value: string): Promise<void> {
    await expect(this.page.locator("#settings-full-name")).toHaveValue(value);
  }

  async setTheme(theme: "Light" | "Dark" | "System"): Promise<void> {
    await this.page
      .getByRole("button", { name: new RegExp(`^${theme}\\b`) })
      .click();
  }

  async expectDarkModeEnabled(): Promise<void> {
    await expect(this.page.locator("html")).toHaveClass(/dark/);
    await expect(this.page.locator("html")).toHaveAttribute("data-theme", /dark|system/);
  }

  async expectStoredTheme(value: "light" | "dark" | "system"): Promise<void> {
    const stored = await this.page.evaluate(() =>
      window.localStorage.getItem("phasebinder-theme"),
    );
    expect(stored).toBe(value);
  }
}
