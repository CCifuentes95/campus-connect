## Context

The built UI (login, dashboard, nav, theme toggle, staff/admin placeholders) matches the
claude-design mockups but a `web-design-guidelines` audit found a consistent quality-floor gap:
no `:focus-visible`, decorative SVGs unlabelled, `<html>` without `color-scheme`, no skip link,
login not recovering focus on error. Tailwind v4 + CSS-var tokens are already in place
(`app/globals.css`), and the theme flips via `[data-theme]`. Three skills are installed
(`frontend-design`, `next-best-practices`, `web-design-guidelines`) and the claude-design project
is reachable via the design MCP.

## Goals / Non-Goals

**Goals:**
- Close the WIG findings on the built pages with mostly **global, low-risk** changes.
- Prefer central fixes (a global focus-visible ring, reduced-motion guard, `color-scheme`) over
  per-element edits, so future screens inherit them.
- Record the skill + mockup definition-of-done in `AGENTS.md`.

**Non-Goals:**
- Any visual redesign — the mockups stay authoritative.
- Building the other 11 claude-design screens (that's US-03…US-08).
- A component-library extraction or token rename.

## Decisions

**Global focus-visible + reduced-motion + color-scheme in `globals.css`.** Add a base layer:
`:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; border-radius: inherit }`
(gold reads on both themes; offset clears the element), a
`@media (prefers-reduced-motion: reduce)` block that neutralises transitions/animations
app-wide, and `color-scheme: light`/`dark` bound to the theme (`:root { color-scheme: light }`,
`:root[data-theme="dark"] { color-scheme: dark }`). *Alternative:* per-component
`focus-visible:ring-*` utilities — more control but easy to forget; the global base guarantees
coverage and per-component utilities can still override. We keep a couple of targeted
`focus-visible:ring` on the nav's on-navy controls where the gold outline needs contrast tuning.

**`theme-color` + skip link in `layout.tsx`.** Add `<meta name="theme-color">` (two, via
`media` for light/dark, matching `--page`). Add a visually-hidden-until-focused "Skip to content"
link as the first focusable element, targeting `#main`; route-group layouts already render
`<main>` — give it `id="main"` and `scroll-margin-top`.

**Decorative icons.** Add `aria-hidden="true"` to every presentational `<svg>` and the priority
dot. Icon-only controls (theme toggle) keep their `aria-label`. Trailing `→` glyphs wrap in an
`aria-hidden` span (the link text carries the meaning).

**Login recovery.** On a failed submit, move focus to the alert (`tabIndex={-1}` + `ref.focus()`),
which already has `role="alert"`. Add `:focus-visible` to inputs; end the email placeholder with
`…`. Keep the existing controlled inputs (cheap) and the enabled-until-request submit.

**Content robustness.** `min-w-0` + `line-clamp-2` on card titles; `tabular-nums` on the date
tile day and any count; `translate="no"` on the `CampusConnect` brand and `#REQ` codes.
`text-wrap: balance` on the hero + lane headings via a small utility.

**Process in `AGENTS.md`.** A short "UI definition-of-done" subsection: match the claude-design
mockup (design MCP), apply frontend-design + next-best-practices, pass web-design-guidelines in
both themes. Extends the existing light/dark precheck rather than replacing it.

## Risks / Trade-offs

- **Global focus ring on already-styled controls** may look heavy on the navy nav → tune with a
  white/gold ring on nav controls specifically; verify contrast in both themes.
- **Reduced-motion blanket rule** could disable an intended transition later → scope it to
  `transition`/`animation` duration overrides, not `display`, so functionality is unaffected.
- **Skip link visible-on-focus** must actually move focus → target a real focusable `<main>`
  (`tabIndex={-1}`) or a heading; verify with keyboard.
- **`translate="no"` / `tabular-nums`** are safe, additive.

## Migration Plan

Additive CSS + attribute edits; no behavior or data changes. Land the global `globals.css` base
first (covers most findings), then the per-file attributes, then `AGENTS.md`. Verify with a
`web-design-guidelines` re-review and Playwright keyboard-focus screenshots in both themes.
Rollback = revert the CSS base + attribute edits.

## Open Questions

- **Focus-ring color on nav vs. body:** single gold ring everywhere vs. white-on-nav / gold-on-body
  — default to gold everywhere, tune only if contrast fails the review.
- **Skip-link placement:** in the root layout (one place, every route) vs. per route-group layout —
  default to the root layout wrapping.
