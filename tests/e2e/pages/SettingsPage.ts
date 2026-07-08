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
    const saveButton = this.page.getByRole("button", { name: "Save profile" });
    const profileUpdateResponse = this.page.waitForResponse(
      (response) =>
        response.url().includes("identitytoolkit.googleapis.com/v1/accounts:update") &&
        response.status() === 200,
      { timeout: 30_000 },
    );

    await this.page.locator("#settings-full-name").fill(value);
    await saveButton.click();

    // Wait for Firebase Auth profile mutation to complete before verification loops.
    await profileUpdateResponse;

    await expect(async () => {
      await this.goto();
      await expect(this.page.locator("#settings-full-name")).toHaveValue(value, {
        timeout: 2_000,
      });
    }).toPass({ timeout: 30_000 });
  }

  async readFullName(): Promise<string> {
    return this.page.locator("#settings-full-name").inputValue();
  }

  async expectFullName(value: string): Promise<void> {
    await expect(async () => {
      await this.goto();
      await expect(this.page.locator("#settings-full-name")).toHaveValue(value, {
        timeout: 3_000,
      });
    }).toPass({ timeout: 30_000 });
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
