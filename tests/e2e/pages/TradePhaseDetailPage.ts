import { type Locator, type Page, expect } from "@playwright/test";
import { tinyPngFile } from "../helpers/files";
import { persistFirestoreWrites } from "../helpers/firestore";

/**
 * Page object for the Trade Phase detail screen (`/trade-phases/[id]`).
 *
 * This screen hosts most of the GC's day-to-day workflow, so the object groups
 * its actions by area: status control, material orders, completion proof, and
 * the punch list. Every assertion is encapsulated here.
 *
 * Phase status is asserted through the "Update status" `<select>`, which the
 * page keeps in sync with the persisted phase status (including after a child
 * action such as blocking on a delay or approving completion). That makes the
 * check unambiguous even when several status badges are on screen.
 */
export class TradePhaseDetailPage {
  constructor(private readonly page: Page) {}

  private get statusSelect() {
    return this.page.locator("#status");
  }

  // --- Status ---------------------------------------------------------------

  /** Choose a status and save it. */
  async setStatus(status: string): Promise<void> {
    await this.statusSelect.selectOption({ label: status });
    await this.page.getByRole("button", { name: "Save status" }).click();
    await expect(this.page.getByText("Status saved.")).toBeVisible();
  }

  /** Confirm the phase is currently persisted at the given status. */
  async expectStatus(status: string): Promise<void> {
    await expect(this.statusSelect).toHaveValue(status);
    await expect(
      this.page.getByText(status, { exact: true }).first(),
    ).toBeVisible();
  }

  // --- Material orders ------------------------------------------------------

  /** Add a material order to this phase. */
  async addMaterialOrder(material: {
    name: string;
    supplier?: string;
    status?: string;
    expectedArrival?: string;
  }): Promise<void> {
    await this.page.locator("#material-name").fill(material.name);
    if (material.supplier) {
      await this.page.locator("#material-supplier").fill(material.supplier);
    }
    if (material.status) {
      await this.page
        .locator("#material-status")
        .selectOption({ label: material.status });
    }
    if (material.expectedArrival) {
      await this.page.locator("#material-expected").fill(material.expectedArrival);
    }
    await this.page.getByRole("button", { name: "Add material order" }).click();
    await expect(this.materialRow(material.name)).toBeVisible();
  }

  /** Change the delivery status of a tracked material order. */
  async setMaterialStatus(name: string, status: string): Promise<void> {
    await this.page
      .getByLabel(`Status for ${name}`)
      .selectOption({ label: status });
  }

  /** Confirm the rolled-up material readiness banner reads "Materials delayed". */
  async expectMaterialsDelayed(): Promise<void> {
    // Match the status pill exactly so we don't also grab the
    // "Block phase — materials delayed" action button.
    await expect(
      this.page.getByText("Materials delayed", { exact: true }),
    ).toBeVisible();
  }

  /** Use the delay shortcut to block the phase, then confirm it is Blocked. */
  async blockPhaseForDelay(): Promise<void> {
    await this.page
      .getByRole("button", { name: "Block phase — materials delayed" })
      .click();
    await expect(this.statusSelect).toHaveValue("Blocked");
  }

  // --- Completion proof -----------------------------------------------------

  /** Submit completion proof (a note plus a photo) and wait for the new entry. */
  async submitCompletionProof(notes: string): Promise<void> {
    await this.page.locator("#completion-note").fill(notes);
    await this.page.locator("#completion-photos").setInputFiles(tinyPngFile());
    await this.page.getByRole("button", { name: "Submit completion" }).click();
    await expect(this.completionEntry("Submitted")).toBeVisible();
  }

  /** Approve the latest submitted completion record. */
  async approveCompletion(): Promise<void> {
    await this.page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(this.completionEntry("Approved")).toBeVisible();
  }

  /** Reject the latest submitted completion record with required feedback. */
  async rejectCompletion(feedback: string): Promise<void> {
    await this.page
      .getByRole("button", { name: "Reject / needs fix" })
      .click();
    await this.page
      .getByPlaceholder("What needs to be fixed?")
      .fill(feedback);
    await this.page
      .getByRole("button", { name: "Send back — needs fix" })
      .click();
    await expect(this.completionEntry("Needs Fix")).toBeVisible();
  }

  // --- Punch list -----------------------------------------------------------

  /** Open the punch form, fill it (optionally assigning a crew), and add it. */
  async addPunchItem(item: {
    title: string;
    description?: string;
    priority?: string;
    dueDate?: string;
    /** Assign the first available contractor (the seed always has several). */
    assignContractor?: boolean;
  }): Promise<void> {
    // The same label toggles the form open and submits it; only one is on
    // screen at a time, so this resolves correctly in both states.
    await this.page.getByRole("button", { name: "Add punch item" }).click();
    await this.page.locator("#punch-title").fill(item.title);
    if (item.description) {
      await this.page.locator("#punch-description").fill(item.description);
    }
    if (item.assignContractor) {
      // Index 0 is "Unassigned", so index 1 is the first real contractor.
      await this.page.locator("#punch-contractor").selectOption({ index: 1 });
    }
    if (item.priority) {
      await this.page
        .locator("#punch-priority")
        .selectOption({ label: item.priority });
    }
    if (item.dueDate) {
      await this.page.locator("#punch-due").fill(item.dueDate);
    }
    await this.page.getByRole("button", { name: "Add punch item" }).click();
    await expect(this.punchRow(item.title)).toBeVisible();
  }

  /**
   * Move a punch item to a new status from its inline dropdown.
   *
   * The status change is optimistic — the UI updates before Firestore confirms
   * the write (and the activity-log entry it fans out to). We wait for those
   * writes to settle so a later navigation can't abort them.
   */
  async setPunchStatus(title: string, status: string): Promise<void> {
    await persistFirestoreWrites(this.page, async () => {
      await this.punchRow(title)
        .getByLabel("Punch item status")
        .selectOption({ label: status });
    });
  }

  /** Confirm the open-punch counter in the section header. */
  async expectOpenPunchCount(count: number): Promise<void> {
    await expect(this.page.getByText(`${count} open`)).toBeVisible();
  }

  // --- internals ------------------------------------------------------------

  private materialRow(name: string): Locator {
    return this.page.locator("li").filter({ hasText: name });
  }

  private completionEntry(status: string): Locator {
    return this.page.locator("li").filter({ hasText: status }).first();
  }

  private punchRow(title: string): Locator {
    return this.page.locator("li").filter({ hasText: title }).first();
  }
}
