/** Shared constants for the e2e suite. */

/**
 * The demo project created by `npm run seed`. Specs that need an existing
 * project/trade fall back to this one. If you seed a different project, set
 * E2E_PROJECT_NAME in tests/e2e/.env to match.
 */
export const DEMO_PROJECT_NAME =
  process.env.E2E_PROJECT_NAME ?? "Maple Street Apartments (Demo)";
