import { type Page, expect } from "@playwright/test";
import { requireEnv } from "../helpers/env";

/**
 * Page object for the authentication screen (`/login`).
 *
 * Firebase Auth stores its session in IndexedDB, which Playwright's saved
 * storage state does not carry between contexts, so each test signs in through
 * the UI. That is intentional: it also exercises the real login path on every
 * run.
 *
 * All assertions live here (and in the other page objects) so the specs read as
 * a plain sequence of business actions.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  private readonly defaultLanding = {
    expectedUrl: "**/dashboard" as string | RegExp,
    expectedHeading: "Dashboard" as string | null,
  };

  private get emailInput() {
    return this.page.locator("#email");
  }

  private get passwordInput() {
    return this.page.locator("#password");
  }

  private get submitButton() {
    return this.page.getByRole("button", { name: "Sign in" });
  }

  /** Navigate straight to the login screen. */
  async goto(): Promise<void> {
    await this.page.goto("/login");
  }

  /**
   * Sign in as the GC test user using the credentials from the environment,
   * then wait until the dashboard has loaded.
   */
  async signInAsGc(): Promise<void> {
    await this.signIn(requireEnv("E2E_GC_EMAIL"), requireEnv("E2E_GC_PASSWORD"));
  }

  /** Sign in with explicit credentials and wait for the app to settle. */
  async signIn(
    email: string,
    password: string,
    options?: {
      expectedUrl?: string | RegExp;
      expectedHeading?: string | null;
    },
  ): Promise<void> {
    await this.ensureLoginPage();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.waitForPostAuth({
      expectedUrl: options?.expectedUrl ?? this.defaultLanding.expectedUrl,
      expectedHeading:
        options?.expectedHeading === undefined
          ? this.defaultLanding.expectedHeading
          : options.expectedHeading,
    });
  }

  /** Create a new account and wait for the dashboard to load. */
  async signUp(
    fullName: string,
    email: string,
    password: string,
    options?: {
      expectedUrl?: string | RegExp;
      expectedHeading?: string | null;
    },
  ): Promise<void> {
    await this.ensureLoginPage();
    const createOne = this.page.getByRole("button", { name: "Create one" });
    if (await createOne.isVisible()) {
      await createOne.click();
    }

    await this.page.locator("#fullName").fill(fullName);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.page.getByRole("button", { name: "Create account" }).click();
    await this.waitForPostAuth({
      expectedUrl: options?.expectedUrl ?? this.defaultLanding.expectedUrl,
      expectedHeading:
        options?.expectedHeading === undefined
          ? this.defaultLanding.expectedHeading
          : options.expectedHeading,
    });
  }

  private async waitForPostAuth(options: {
    expectedUrl: string | RegExp;
    expectedHeading: string | null;
  }): Promise<void> {
    // The (app) layout only renders once Firebase confirms the session.
    await this.page.waitForURL(options.expectedUrl, { timeout: 30_000 });
    if (options.expectedHeading) {
      await expect(
        this.page.getByRole("heading", {
          name: options.expectedHeading,
          level: 1,
        }),
      ).toBeVisible();
    }
  }

  private async ensureLoginPage(): Promise<void> {
    if (/\/login/.test(this.page.url())) {
      await expect(this.submitButton).toBeVisible({ timeout: 30_000 });
      return;
    }
    await this.goto();
  }

  /** Confirm an invalid sign-in is rejected with a visible error. */
  async expectSignInRejected(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/);
    await expect(this.page.getByText(/incorrect email or password/i)).toBeVisible();
  }

  /**
   * Confirm that visiting a protected route while signed out bounces the user
   * to the login screen.
   */
  async expectRouteRequiresLogin(path: string): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForURL(/\/login/);
    await expect(this.submitButton).toBeVisible();
  }
}
