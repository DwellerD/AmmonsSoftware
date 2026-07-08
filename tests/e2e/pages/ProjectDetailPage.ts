import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for project detail screen (`/projects/:id`) sharing controls.
 */
export class ProjectDetailPage {
  constructor(private readonly page: Page) {}

  async expectLoaded(projectName: string): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: projectName, level: 1 }),
    ).toBeVisible({ timeout: 30_000 });
  }

  async createInvite(invitedEmail: string, message?: string): Promise<string> {
    await this.page.locator("#invite-email").fill(invitedEmail);
    if (message) {
      await this.page.locator("#invite-message").fill(message);
    } else {
      await this.page.locator("#invite-message").fill("");
    }

    await this.page.getByRole("button", { name: "Create invite" }).click();

    const inviteReady = this.page.getByText("Invite link ready").first();
    await expect(inviteReady).toBeVisible({ timeout: 30_000 });

    const urlText = this.page
      .locator("p")
      .filter({ hasText: /\/invite\// })
      .first();
    await expect(urlText).toBeVisible({ timeout: 30_000 });

    const url = (await urlText.innerText()).trim();
    if (!url.includes("/invite/")) {
      throw new Error(`Invite link was not visible for ${invitedEmail}.`);
    }
    return url;
  }

  async expectMemberVisible(email: string): Promise<void> {
    await expect(this.memberRow(email)).toBeVisible({ timeout: 30_000 });
  }

  async expectMemberHidden(email: string): Promise<void> {
    await expect(this.memberRow(email)).toHaveCount(0);
  }

  async openMemberManageDialog(email: string): Promise<void> {
    const row = this.memberRow(email);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole("button", { name: "Edit access" }).click();
    await expect(this.manageDialog()).toBeVisible({ timeout: 30_000 });
    await expect(this.manageDialog().getByRole("button", { name: "Save access" })).toBeVisible({
      timeout: 30_000,
    });
  }

  async setDialogPermission(label: string, enabled: boolean): Promise<void> {
    const option = this.manageDialog()
      .locator("label", { hasText: label })
      .first();
    await expect(option).toBeVisible({ timeout: 30_000 });

    const checkbox = option.locator("input[type='checkbox']").first();
    if (enabled) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }

  async saveDialogAccess(): Promise<void> {
    await this.manageDialog().getByRole("button", { name: "Save access" }).click();
    await expect(this.manageDialog()).toHaveCount(0, { timeout: 30_000 });
  }

  async revokeAllAccessFromDialog(): Promise<void> {
    this.page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await this.manageDialog().getByRole("button", { name: "Revoke all access" }).click();
    await expect(this.manageDialog()).toHaveCount(0, { timeout: 30_000 });
  }

  private membersSection(): Locator {
    return this.page
      .locator("div", {
        has: this.page.getByRole("heading", { name: "Members", exact: true }),
      })
      .first();
  }

  private memberRow(email: string): Locator {
    return this.membersSection()
      .locator("div[aria-label^='Member ']")
      .filter({ hasText: email })
      .first();
  }

  private manageDialog(): Locator {
    return this.page.getByRole("dialog");
  }
}
