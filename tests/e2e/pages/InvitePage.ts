import { type Page, expect } from "@playwright/test";

/**
 * Page object for public invite URLs (`/invite/:token`).
 */
export class InvitePage {
  constructor(private readonly page: Page) {}

  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  async expectInviteDetails(projectName: string, invitedByEmail: string): Promise<void> {
    await expect(this.page.getByRole("heading", { name: new RegExp(escapeRegExp(projectName)) })).toBeVisible({
      timeout: 30_000,
    });
    await expect(this.page.getByText(`Invited by: ${invitedByEmail}`)).toBeVisible({
      timeout: 30_000,
    });
  }

  async expectSignedOutPrompt(invitedEmail: string): Promise<void> {
    await expect(this.page.getByText("Sign in to accept")).toBeVisible({ timeout: 30_000 });
    await expect(
      this.page.getByText(`Use the email address ${invitedEmail} to accept this invite.`),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      this.page.getByRole("button", { name: "Sign in or create account" }),
    ).toBeVisible({ timeout: 30_000 });
  }

  async clickSignInOrCreate(): Promise<void> {
    await this.page.getByRole("button", { name: "Sign in or create account" }).click();
    await this.page.waitForURL(/\/login\?redirectTo=/, { timeout: 30_000 });
  }

  async expectWrongAccount(signedInEmail: string, invitedEmail: string): Promise<void> {
    await expect(this.page.getByText("Wrong account")).toBeVisible({ timeout: 30_000 });
    await expect(
      this.page.getByText(`You are signed in as ${signedInEmail}. This invite was sent to ${invitedEmail}.`),
    ).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByRole("button", { name: "Switch account" })).toBeVisible({
      timeout: 30_000,
    });
  }

  async clickSwitchAccount(): Promise<void> {
    await this.page.getByRole("button", { name: "Switch account" }).click();
    await this.page.waitForURL(/\/login\?redirectTo=/, { timeout: 30_000 });
  }

  async acceptInvite(): Promise<void> {
    await this.page.getByRole("button", { name: "Accept invite" }).click();
  }

  async rejectInvite(): Promise<void> {
    await this.page.getByRole("button", { name: "Reject invite" }).click();
  }

  async expectInviteDeclined(projectName: string): Promise<void> {
    await expect(this.page.getByRole("heading", { name: "Invite declined", level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await expect(this.page.getByText(`You declined access to ${projectName}.`)).toBeVisible({
      timeout: 30_000,
    });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
