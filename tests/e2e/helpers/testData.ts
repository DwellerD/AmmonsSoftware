/**
 * Small helpers for generating collision-free test data.
 *
 * Every spec creates the records it needs (a trade phase, a material order, a
 * document, …) rather than depending on a fixed seed row. Tagging each name
 * with a unique run id keeps tests independent and re-runnable: a second run
 * never clashes with data from the first.
 */

/** A short, sortable, unique-enough id for a single test run. */
export function runId(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${time}${rand}`;
}

/** Builds a labelled, unique name, e.g. uniqueName("Roof trusses") -> "Roof trusses [e2e-l9k2…]". */
export function uniqueName(label: string): string {
  return `${label} [e2e-${runId()}]`;
}

/** Today as a YYYY-MM-DD string (matches the app's date inputs). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A date `days` in the future as YYYY-MM-DD. */
export function futureIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Escapes a string for safe use inside a `RegExp`. Unique names contain `[` and
 * `]` (e.g. `"Roof trusses [e2e-…]"`), which are regex metacharacters, so they
 * must be escaped before building an activity-feed matcher from them.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
