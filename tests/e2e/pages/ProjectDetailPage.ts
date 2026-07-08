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

    const row = this.inviteRow(invitedEmail);
    await expect(row).toBeVisible({ timeout: 30_000 });

    const url = (await row.locator("p").last().innerText()).trim();
    if (!url.includes("/invite/")) {
      throw new Error(`Invite link was not visible for ${invitedEmail}.`);
    }
    return url;
  }

  async expectInviteStatus(invitedEmail: string, status: string): Promise<void> {
    const row = this.inviteRow(invitedEmail);
    await expect(row).toContainText(status, { timeout: 30_000 });
  }

  async revokeInvite(invitedEmail: string): Promise<void> {
    const row = this.inviteRow(invitedEmail);
    await row.getByRole("button", { name: "Revoke" }).click();
    await expect(row).toContainText("Revoked", { timeout: 30_000 });
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
    await row.getByRole("button", { name: "Revoke" }).click();
    await expect(this.manageDialog()).toBeVisible({ timeout: 30_000 });
  }

  async chooseDialogEditAccess(): Promise<void> {
    await this.manageDialog().getByRole("button", { name: "Edit access live" }).click();
    await expect(this.manageDialog().getByRole("button", { name: "Save access" })).toBeVisible({
      timeout: 30_000,
    });
  }

  async chooseDialogRemoveCompletely(): Promise<void> {
    await this.manageDialog().getByRole("button", { name: "Remove from project completely" }).click();
    await expect(
      this.manageDialog().getByRole("button", { name: "Remove from project" }),
    ).toBeVisible({ timeout: 30_000 });
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
    await expect(this.manageDialog().getByRole("button", { name: "Edit access live" })).toBeVisible({
      timeout: 30_000,
    });
  }

  async confirmDialogRemove(): Promise<void> {
    await this.manageDialog().getByRole("button", { name: "Remove from project" }).click();
    await expect(this.manageDialog()).toHaveCount(0, { timeout: 30_000 });
  }

  private membersSection(): Locator {
    return this.page
      .locator("div", {
        has: this.page.getByRole("heading", { name: "Members", exact: true }),
      })
      .first();
  }

  private invitesSection(): Locator {
    return this.page
      .locator("div", {
        has: this.page.getByRole("heading", { name: "Invites", exact: true }),
      })
      .first();
  }

  private memberRow(email: string): Locator {
    return this.membersSection()
      .locator("div[aria-label^='Member ']")
      .filter({ hasText: email })
      .first();
  }

  private inviteRow(email: string): Locator {
    return this.invitesSection()
      .locator("div[aria-label^='Invite ']")
      .filter({ hasText: email })
      .first();
  }

  private manageDialog(): Locator {
    return this.page.getByRole("dialog");
  }
}
