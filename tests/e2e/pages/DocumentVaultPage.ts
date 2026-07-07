import { type Locator, type Page, expect } from "@playwright/test";
import { DEMO_PROJECT_NAME } from "../helpers/constants";
import { blueprintPdfFile } from "../helpers/files";

/**
 * Page object for the Document Vault (`/documents`) and its upload form
 * (`/documents/new`).
 */
export class DocumentVaultPage {
  constructor(private readonly page: Page) {}

  private get searchBox() {
    return this.page.getByLabel("Search documents by name or tag");
  }

  private get pinnedPlansSection() {
    return this.page
      .locator("section")
      .filter({ hasText: "Pinned blueprints & layouts" });
  }

  async goto(): Promise<void> {
    await this.page.goto("/documents");
    await expect(
      this.page.getByRole("heading", { name: "Document Vault", level: 1 }),
    ).toBeVisible();
  }

  /**
   * Upload a pinned blueprint and tag it to the seeded project. Returns once the
   * upload has succeeded.
   */
  async uploadPinnedBlueprint(doc: {
    name: string;
    tags: string;
    documentType?: "Blueprint" | "Layout";
  }): Promise<void> {
    await this.page.goto("/documents/new");
    await this.page.locator("#doc-file").setInputFiles(blueprintPdfFile());
    await this.page.locator("#doc-name").fill(doc.name);
    await this.page
      .locator("#doc-type")
      .selectOption({ label: doc.documentType ?? "Blueprint" });
    await this.selectSeededProject();
    await this.page.locator("#doc-tags").fill(doc.tags);
    await this.page
      .getByRole("checkbox", { name: /pin this document/i })
      .check();
    await this.page.getByRole("button", { name: "Upload document" }).click();
    // On success the form redirects to the vault, so confirm we land there with
    // the new document present rather than racing the transient success alert.
    await this.page.waitForURL("**/documents");
    await expect(this.documentLink(doc.name).first()).toBeVisible();
  }

  /** Search the vault by document name or tag. */
  async search(term: string): Promise<void> {
    await this.searchBox.fill(term);
  }

  /** Confirm a document shows up as a pinned plan at the top of the vault. */
  async expectPinnedPlan(name: string): Promise<void> {
    await expect(
      this.pinnedPlansSection.getByText(`★ ${name}`),
    ).toBeVisible();
  }

  /** Confirm a document is present in the (filtered) results. */
  async expectDocumentVisible(name: string): Promise<void> {
    await expect(this.documentLink(name).first()).toBeVisible();
  }

  // --- internals ------------------------------------------------------------

  private documentLink(name: string): Locator {
    return this.page.getByRole("link", { name: new RegExp(escapeRegExp(name)) });
  }

  private async selectSeededProject(): Promise<void> {
    const select = this.page.locator("#doc-project");
    const demoCount = await select
      .locator("option", { hasText: DEMO_PROJECT_NAME })
      .count();
    if (demoCount > 0) {
      await select.selectOption({ label: DEMO_PROJECT_NAME });
    } else {
      // Fall back to the first real project (index 0 is the placeholder).
      await select.selectOption({ index: 1 });
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
