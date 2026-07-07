import { type Page, type Response } from "@playwright/test";

/** The Firestore WebChannel endpoint every mutation is POSTed to. */
const WRITE_CHANNEL = "/google.firestore.v1.Firestore/Write/channel";

/**
 * Runs an action that triggers one or more Firestore writes and waits for the
 * backend to acknowledge them before resolving.
 *
 * The app uses an optimistic UI: it updates local React state immediately and
 * lets the Firestore write (plus any activity-log fan-out) settle in the
 * background. Because the client uses Firestore's default in-memory cache,
 * navigating away before those writes are acknowledged silently drops them.
 * Actions like resolving a punch item fire two sequential writes (the status
 * update, then the activity-log entry), so a test that acts and immediately
 * navigates can lose the second write.
 *
 * Waiting until the write channel has been quiet for `quietMs` keeps the data —
 * and the activity-log entries derived from it — durable across the navigation
 * that follows.
 */
export async function persistFirestoreWrites(
  page: Page,
  action: () => Promise<void>,
  options: { quietMs?: number; timeout?: number } = {},
): Promise<void> {
  const quietMs = options.quietMs ?? 750;
  const timeout = options.timeout ?? 15_000;

  let lastWriteAt = 0;
  const onResponse = (response: Response) => {
    if (
      response.request().method() === "POST" &&
      response.url().includes(WRITE_CHANNEL)
    ) {
      lastWriteAt = Date.now();
    }
  };

  page.on("response", onResponse);
  try {
    await action();
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (lastWriteAt && Date.now() - lastWriteAt >= quietMs) return;
      await page.waitForTimeout(100);
    }
  } finally {
    page.off("response", onResponse);
  }
}
