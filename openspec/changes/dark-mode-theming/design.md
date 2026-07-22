## Context

Tailwind v4 is configured in `app/globals.css` with an `@theme` block of **fixed brand color
tokens** (`--color-navy`, `--color-gold`, …) plus an `@theme inline` block that already proves
the flip mechanism: `--color-background: var(--background)`, where `--background` is redefined
under a media query. Components today mix those brand utilities with raw hex. A leftover
`@media (prefers-color-scheme: dark)` swaps only `--background`/`--foreground`, producing the
half-broken dark look. The root layout (`app/layout.tsx`) is a plain server component and can
read cookies. Design source: `docs/design-brief.md` (`.cc-dark`, toggle in nav, persist per user).

## Goals / Non-Goals

**Goals:**
- A semantic token layer that flips light↔dark from one root marker.
- Refactor the currently-built surfaces (nav, dashboard, login, staff/admin placeholders) onto it.
- A nav toggle that persists (cookie) and renders the correct theme server-side with no flash.
- OS `prefers-color-scheme` as the default until the user chooses.

**Non-Goals:**
- Per-user server-side theme storage (Firestore `notificationPrefs`-style) — a cookie is enough
  for the MVP; a profile-backed pref can come later.
- A full component library / design-system extraction. We retheme what exists; new screens adopt
  the tokens as they're built.
- Animated theme transitions.

## Decisions

**Semantic tokens over `@theme inline`, brand palette stays fixed.** Add role tokens in
`:root` — `--page`, `--surface`, `--surface-2`, `--ink`, `--body`, `--muted`, `--border`,
`--accent`, `--accent-ink` — and register them via `@theme inline` (`--color-page: var(--page)`
…) so utilities (`bg-page`, `text-ink`, `border-border`, `bg-accent`) reference the variable and
therefore flip. Redefine the same variables under `:root[data-theme="dark"]`. Keep
`--color-navy/gold/teal` as the fixed palette the light/dark roles point at. *Alternative:*
Tailwind `dark:` variant on every element — rejected: doubles every class and is what makes
dark themes rot; a token flip restyles centrally.

**Root marker = `data-theme` on `<html>`.** Light is the default (no dark overrides);
`data-theme="dark"` activates the dark block. *Alternative:* the design brief's `.cc-dark`
class — equivalent; `data-theme` reads cleaner for a toggle and pairs with
`suppressHydrationWarning`.

**Persistence = cookie `cc-theme`, source-of-truth for explicit choice.** Values `light`/`dark`.
Not httpOnly — it's a display preference, not a secret — so the client toggle can set it
directly (`document.cookie`) and the server can read it. `app/layout.tsx` awaits `cookies()`,
and if `cc-theme` is present sets `<html data-theme={value}>` at render → **no flash for anyone
who has chosen**.

**No-flash for the OS-default case = a tiny pre-paint inline script.** When no cookie exists the
server can't know the OS preference, so the layout injects a small blocking script (before
body content) that sets `document.documentElement.dataset.theme` from
`matchMedia('(prefers-color-scheme: dark)')`. `<html>` gets `suppressHydrationWarning` because
the attribute may be set by the script/cookie. This keeps the first paint correct without a
client round-trip.

**Toggle = a small client component in the nav.** It reads the current theme (from the resolved
`<html>` attribute on mount), and on click: flips `document.documentElement.dataset.theme`,
writes the `cc-theme` cookie (path=/, long max-age), and updates its own label/icon. No reload
needed. It receives the server-resolved initial theme as a prop to render the right icon on
first paint.

**Refactor scope by file** (from the hex survey): `components/nav/top-nav.tsx` (most hex),
`components/dashboard/{request-card,appointment-card,lane}.tsx`, `app/(student)/page.tsx`,
`app/login/*`, and the `app/(staff)`/`app/(admin)` placeholders. Priority-tint chip colors on
request cards stay as their semantic priority colors (they read on both themes; verify contrast).

## Risks / Trade-offs

- **Hydration mismatch on `<html>`** (script/cookie sets an attribute the server didn't) →
  `suppressHydrationWarning` on `<html>`, and prefer the cookie path so the server value matches.
- **Flash of wrong theme** → cookie handles explicit choosers server-side; the inline pre-paint
  script handles OS-default; never resolve theme in a `useEffect` (too late, flashes).
- **Missed hardcoded hex** leaves a light-colored island in dark → grep for `#` in the touched
  files after refactor; the light/dark precheck (now a standing step) catches the rest visually.
- **Priority/status chip contrast** in dark (amber/red/green tints designed on white) → check and,
  if needed, give those chips dark-theme variants via tokens.

## Migration Plan

Additive then subtractive: add the token layer and the toggle, refactor components file-by-file
(each stays working in light throughout), then delete the old `prefers-color-scheme` bg/fg
override last. No data, rules, or dependency changes. Rollback = revert `globals.css` + layout;
components fall back to tokens that still resolve to the light palette. Verify by toggling on the
dashboard and login in both themes (Playwright screenshot each), and with the OS set to dark and
no cookie.

## Open Questions

- **Toggle affordance:** icon-only (sun/moon) vs. a labeled segmented control — default to a
  compact icon button in the nav's right cluster; confirm against the design brief's kit.
- **Persist to profile later?** Cookie now; a `users/{uid}` theme pref could sync across devices
  in a future notifications/preferences story (US-06) — out of scope here.
