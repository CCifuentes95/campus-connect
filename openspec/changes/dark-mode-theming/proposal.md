## Why

The design brief ships every screen in **light and dark** (`.cc-dark`) with a theme toggle in
the top nav, but the app is light-only. Worse, `app/globals.css` has a stray
`@media (prefers-color-scheme: dark)` that flips only `--background`/`--foreground`, so on an
OS set to dark the UI renders half-broken — near-black page behind white cards and navy text
that's nearly illegible (seen on the US-02 dashboard). We need real, app-wide theming and a
user-controlled toggle, and it should exist before more screens are built so each one is
verified in both themes as it lands (the finish-feature precheck).

## What Changes

- Introduce **theme-aware semantic tokens** in `app/globals.css` — roles like `page`,
  `surface`, `ink`, `body`, `muted`, `border`, `accent` — defined for light and redefined for
  dark (design-brief `.cc-dark`: page `#081826`, surface `#0f2942`, gold accent replaces navy
  for active states). Brand constants (navy/gold/teal) stay as fixed values the semantic tokens
  reference.
- **Refactor components off hardcoded hex and fixed brand tokens** onto the semantic tokens so
  they adapt automatically: nav, dashboard cards/lanes, login, and the staff/admin placeholders.
- Add a **persisted theme toggle** in the top nav: it sets a `data-theme` (or `.cc-dark`) on the
  `<html>` element and writes a **cookie** so the server can render the correct theme on first
  paint — **no flash of the wrong theme**. Default follows the OS (`prefers-color-scheme`) until
  the user chooses.
- **Remove the broken partial-dark** `@media (prefers-color-scheme: dark)` override that only
  swaps `--background`/`--foreground`.
- **BREAKING (visual only):** raw hex is retired on the touched surfaces; those components now
  derive all color from tokens.

## Capabilities

### New Capabilities
- `theming`: app-wide light/dark theming — a semantic design-token layer that flips by theme, a
  user-controlled + OS-default theme selection persisted across requests (no-flash SSR), and a
  toggle surfaced in the top nav on every screen.

### Modified Capabilities
<!-- No behavioral spec changes. authentication / role-access / student-dashboard requirements
     are unchanged; this is a presentation-layer capability they render within. -->

## Impact

- **Code:** `app/globals.css` (token layer), `app/layout.tsx` (read theme cookie → set initial
  `<html>` attribute, no-flash), `components/nav/top-nav.tsx` (+ a small client toggle
  component), and the color refactor across `components/dashboard/*`, `app/login/*`, and the
  `app/(staff)`/`app/(admin)` placeholders. A tiny cookie/theme helper in `lib/`.
- **Dependencies:** none new — CSS variables + a client component. No Tailwind plugin required.
- **Cross-cutting:** delivers the roadmap's "design tokens" + "dark theme" items and makes the
  light/dark finish-feature precheck meaningful for every future story.
