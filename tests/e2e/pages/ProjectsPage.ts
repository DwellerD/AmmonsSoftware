import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for the Projects workspace (`/projects`).
 */
export class ProjectsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/projects");
    await expect(
      this.page.getByRole("heading", { name: "Projects", level: 1 }),
    ).toBeVisible();
  }

  /** Create a project from the inline form and assert it appears in the list. */
  async createProject(name: string): Promise<void> {
    await this.goto();
    await this.page.getByRole("button", { name: "New project" }).first().click();

    const nameInput = this.page.locator("#name");
    const saveButton = this.page.getByRole("button", { name: "Save project" });
    const permissionDenied = this.page.getByText("Missing or insufficient permissions.");

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await nameInput.fill(name);
      await saveButton.click();

      await this.page.waitForFunction(
        () => {
          const formNameInput = document.querySelector("#name");
          if (!formNameInput) return true;
          return (
            document.body.textContent?.includes("Missing or insufficient permissions.") ??
            false
          );
        },
        undefined,
        { timeout: 30_000 },
      );

      const denied = await permissionDenied.isVisible({ timeout: 3_000 }).catch(() => false);
      if (!denied) {
        break;
      }

      if (attempt === 1) {
        throw new Error("Project save was denied twice. Auth session was not ready.");
      }

      await this.goto();
      await this.page.getByRole("button", { name: "New project" }).first().click();
    }

    await expect(async () => {
      await this.goto();
      await expect(this.projectLink(name)).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 45_000 });
  }

  async expectProjectVisible(name: string): Promise<void> {
    await this.goto();
    await expect(this.projectLink(name)).toBeVisible();
  }

  async openProject(name: string): Promise<void> {
    await this.goto();
    await this.projectLink(name).click();
    await this.page.waitForURL(/\/projects\/[^/]+$/, { timeout: 30_000 });
  }

  async expectProjectHidden(name: string): Promise<void> {
    await this.goto();
    await expect(this.projectLink(name)).toHaveCount(0);
  }

  async expectNoProjectsYet(): Promise<void> {
    await this.goto();
    await expect(this.page.getByText("No projects yet")).toBeVisible();
  }

  private projectLink(name: string): Locator {
    return this.page
      .getByRole("link", { name: new RegExp(escapeRegExp(name)) })
      .first();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
