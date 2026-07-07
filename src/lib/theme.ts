export type AppTheme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "phasebinder-theme";
const LEGACY_THEME_STORAGE_KEY = "tradeflow-theme";
export const DEFAULT_THEME: AppTheme = "system";

export function normalizeTheme(value: string | null | undefined): AppTheme {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return DEFAULT_THEME;
}

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveTheme(theme: AppTheme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

export function readStoredTheme(): AppTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const current = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (current) return normalizeTheme(current);

  const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (legacy) {
    const theme = normalizeTheme(legacy);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    return theme;
  }

  return DEFAULT_THEME;
}

export function persistTheme(theme: AppTheme): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function applyTheme(theme: AppTheme): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = resolved;
}

export const THEME_INIT_SCRIPT = `(() => {
  try {
    const key = "${THEME_STORAGE_KEY}";
    const stored = localStorage.getItem(key);
    const theme = stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.dataset.theme = theme;
    root.style.colorScheme = resolved;
  } catch {
    // no-op
  }
})();`;
