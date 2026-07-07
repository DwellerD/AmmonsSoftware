import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotEnv } from "dotenv";

/**
 * Loads the e2e-only environment file (tests/e2e/.env) if it exists.
 *
 * Test credentials are deliberately kept out of the app's `.env.local` and out
 * of source control. Anything already set in the real environment wins, so CI
 * can inject secrets without a file present.
 */
export function loadE2EEnv(): void {
  const envPath = resolve(__dirname, "..", ".env");
  if (existsSync(envPath)) {
    loadDotEnv({ path: envPath });
  }
}

/** A required env var, with a clear message if it is missing. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        `Copy tests/e2e/.env.example to tests/e2e/.env and fill it in ` +
        `(see tests/e2e/README.md).`,
    );
  }
  return value;
}
