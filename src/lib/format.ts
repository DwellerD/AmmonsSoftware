/**
 * Small formatting helpers for dates and relative times.
 * Kept dependency-free so they are easy to read and tweak.
 */

/** Formats an ISO date (or date string) as e.g. "Jun 29, 2026". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Returns today's date as YYYY-MM-DD (matches Postgres `date` columns). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Formats a timestamp as a short relative string, e.g. "3h ago". */
export function timeAgo(value: string): string {
  const then = new Date(value).getTime();
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}
