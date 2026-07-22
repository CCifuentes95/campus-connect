## Why

The dashboard and login match their design mockups visually, but the mockups don't encode the
**quality floor** — keyboard focus, semantics, reduced motion, native-control theming — and an
audit against the Web Interface Guidelines surfaced systemic gaps (no `:focus-visible` anywhere,
decorative SVGs unlabelled, `<html>` missing `color-scheme`, no skip link). We also now have
three design skills (`frontend-design`, `next-best-practices`, `web-design-guidelines`) and an
imported **claude-design** project (13 screens + UI kit), but nothing ties them into how UI is
built. This change fixes the current gaps and makes those skills + mockups the standing UI
definition-of-done, so US-03…US-08 ship accessible and on-design from the start.

## What Changes

- **Fix the built pages** (login, student dashboard, top nav, `theme-toggle`, staff/admin
  placeholders) against the Web Interface Guidelines:
  - Add visible `:focus-visible` rings to every interactive element; add a skip-link to `<main>`.
  - `aria-hidden="true"` on decorative icons (status/priority/clock/calendar/message/plus/arrows).
  - `<html>` gets `color-scheme` per theme + a `<meta name="theme-color">`.
  - Login: move focus to the first error / alert on failed submit; `:focus-visible` on inputs;
    placeholder ends with `…`.
  - Guard long content (`line-clamp`/`min-w-0`), `tabular-nums` on numeric tiles, `translate="no"`
    on brand/`#REQ` tokens, `text-wrap: balance` on headings.
- **Codify the workflow** in `AGENTS.md`: building or changing UI **MUST** (1) match the relevant
  `claude-design` mockup (pull it via the design MCP), (2) apply `frontend-design` +
  `next-best-practices`, and (3) pass a `web-design-guidelines` review in **both themes** before
  a UI task is done — extending the existing light/dark precheck.
- **No visual redesign** — the pinned mockups still win; this is quality + process, not aesthetics.

## Capabilities

### New Capabilities
- `ui-quality`: the cross-cutting quality bar for the web UI — Web Interface Guidelines
  compliance (accessibility, focus, semantics, theming), fidelity to the claude-design mockups,
  and the skill-driven definition-of-done that every screen is built and reviewed against.

### Modified Capabilities
<!-- No behavioral requirement changes to authentication / role-access / student-dashboard /
     theming; those screens gain quality attributes but their functional specs are unchanged. -->

## Impact

- **Code:** `app/layout.tsx` (color-scheme, theme-color, skip link target), `app/globals.css`
  (global focus-visible + reduced-motion + `color-scheme`), `components/nav/*`,
  `components/dashboard/*`, `app/(student)/page.tsx`, `app/login/login-form.tsx`, and the
  staff/admin placeholders.
- **Docs:** `AGENTS.md` gains a "UI definition-of-done" section referencing the three skills and
  the claude-design project; the roadmap's cross-cutting list notes it.
- **Process:** future UI stories inherit the DoD — small per-story cost, large consistency gain.
- **Dependencies:** none new (skills are already installed; the design MCP is already connected).
