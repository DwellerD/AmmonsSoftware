/**
 * Tiny helper to join Tailwind class names conditionally.
 * Filters out false/null/undefined so you can write:
 *   cn("base", isActive && "active", error ? "border-red-500" : null)
 */
export function cn(
  ...classes: (string | false | null | undefined)[]
): string {
  return classes.filter(Boolean).join(" ");
}
