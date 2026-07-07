import { type Page, type TestInfo } from "@playwright/test";

/**
 * Saves a labelled, full-page screenshot at a meaningful point in a test and
 * attaches it to the Playwright HTML report.
 *
 * These are the images intended for the QA dashboard: each one is named
 * `NN-label` so the story of the test reads in order, and they live under
 * `test-results/screenshots/<spec>/`.
 */
export async function captureMilestone(
  page: Page,
  testInfo: TestInfo,
  label: string,
): Promise<void> {
  const step = String(nextStep(testInfo)).padStart(2, "0");
  const safeLabel = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const fileName = `${step}-${safeLabel}.png`;

  const path = testInfo.outputPath("screenshots", fileName);
  const buffer = await page.screenshot({ path, fullPage: true });

  // Attaching makes the screenshot show up inline in the HTML report.
  await testInfo.attach(`${step} — ${label}`, {
    body: buffer,
    contentType: "image/png",
  });
}

/** Per-test counter so milestone screenshots stay in capture order. */
function nextStep(testInfo: TestInfo): number {
  const key = "__milestoneStep" as const;
  const store = testInfo as TestInfo & { [key]?: number };
  store[key] = (store[key] ?? 0) + 1;
  return store[key]!;
}
