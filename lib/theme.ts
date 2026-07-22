// Light/dark theme plumbing. Constants + helpers are import-safe from both server and client
// (no next/headers here). The server reads the cookie in app/layout.tsx; the client toggle uses
// setTheme(). The theme marker is `data-theme` on <html>; the cookie is the persisted choice.

export type Theme = "light" | "dark";

export const THEME_COOKIE = "cc-theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** Client-only: apply the theme to <html> and persist it for future SSR renders. */
export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${ONE_YEAR};samesite=lax`;
}

/**
 * Pre-paint script: sets <html data-theme> before the body renders, so there's no flash. It
 * reads the persisted cookie first (explicit choice), else falls back to the OS preference.
 * Running it client-side (rather than reading the cookie in the root layout) keeps every route
 * statically prerenderable — notably /login (see AGENTS.md). Pairs with suppressHydrationWarning.
 */
export const NO_FLASH_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var t=m?m[1]:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){}})();`;
