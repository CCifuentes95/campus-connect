## 1. Token layer

- [x] 1.1 In `app/globals.css`, add semantic role variables to `:root` (light): `--page`,
      `--surface`, `--surface-2`, `--ink`, `--body`, `--muted`, `--border`, `--accent`,
      `--accent-ink`, mapping to the current brand palette.
- [x] 1.2 Add a `:root[data-theme="dark"]` block redefining those roles per design-brief
      `.cc-dark` (page `#081826`, surface `#0f2942`, light ink/body, gold accent for active).
- [x] 1.3 Register the roles in `@theme inline` (`--color-page: var(--page)`, `--color-ink:
      var(--ink)`, …) so utilities `bg-page` / `text-ink` / `border-border` / `bg-accent` exist
      and flip. Keep the fixed `--color-navy/gold/teal` palette.
- [x] 1.4 Remove the broken `@media (prefers-color-scheme: dark)` bg/fg-only override; set `body`
      to use `bg-page` / `text-body` (or the mapped vars).

## 2. No-flash theme resolution

- [x] 2.1 Add a `lib/theme.ts` helper: cookie name (`cc-theme`), read-from-cookie (server), and a
      client `setTheme(theme)` that sets `document.documentElement.dataset.theme` + writes the
      cookie (path=/, long max-age).
- [x] 2.2 In `app/layout.tsx`, `await cookies()`, and if `cc-theme` is set render
      `<html data-theme={value}>`; add `suppressHydrationWarning` to `<html>`.
- [x] 2.3 Inject a tiny pre-paint inline script (only needed when no cookie) that sets
      `data-theme` from `matchMedia('(prefers-color-scheme: dark)')`, so the OS-default case has
      no flash.

## 3. Theme toggle in the nav

- [x] 3.1 Build `components/nav/theme-toggle.tsx` (`"use client"`): renders a sun/moon toggle,
      reads the initial theme from a prop, flips `data-theme` + persists via `lib/theme.ts` on
      click, updates its icon.
- [x] 3.2 Render the toggle in `components/nav/top-nav.tsx` (right cluster, every screen); pass
      the server-resolved initial theme through so first paint shows the right icon.

## 4. Refactor components onto tokens

- [x] 4.1 `components/nav/top-nav.tsx` — replace hardcoded hex/brand utilities with semantic
      tokens; nav surface uses the themed navy/surface so it deepens in dark.
- [x] 4.2 `components/dashboard/{request-card,appointment-card,lane}.tsx` — surfaces, text,
      borders, empty/error states, and CTAs onto tokens; keep priority tints but verify contrast
      in dark (add dark variants via tokens if needed).
- [x] 4.3 `app/(student)/page.tsx` — hero + grid onto tokens (fix the navy-on-dark heading).
- [x] 4.4 `app/login/*` — form, brand panel, alert onto tokens (both themes legible).
- [x] 4.5 `app/(staff)/staff/triage/page.tsx` and `app/(admin)/admin/reports/page.tsx`
      placeholders onto tokens.

## 5. Verify (light + dark precheck)

- [x] 5.1 `tsc`/lint clean; `next build` succeeds.
- [x] 5.2 Grep the touched files for leftover `#` hex in color roles; none remain (except the
      intentional priority-tint palette).
- [x] 5.3 Playwright: load the dashboard and login, toggle the theme, screenshot **both** light
      and dark — confirm legible text, correct surfaces, gold accents in dark, and no flash.
- [x] 5.4 With the OS set to dark and no `cc-theme` cookie, first paint is fully dark (not the old
      partial override); after toggling to light, the cookie persists across a reload.
