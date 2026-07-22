## 1. Global base (globals.css)

- [x] 1.1 Add a `:focus-visible` base ring (2px gold outline + offset) so every interactive
      element gets a visible keyboard focus indicator; ensure no `outline:none` without a
      replacement.
- [x] 1.2 Add `color-scheme: light` on `:root` and `color-scheme: dark` on
      `:root[data-theme="dark"]` (native scrollbars/inputs).
- [x] 1.3 Add a `@media (prefers-reduced-motion: reduce)` block that reduces/removes transition
      and animation durations app-wide.
- [x] 1.4 Add a small `text-wrap: balance` helper (or apply via utility) for headings.

## 2. Document shell (layout.tsx + main landmark)

- [x] 2.1 Add `<meta name="theme-color">` (light/dark via `media`) matching `--page`.
- [x] 2.2 Add a "Skip to content" link as the first focusable element, targeting `#main`
      (visually hidden until focused).
- [x] 2.3 Give the route-group `<main>` `id="main"`, `tabIndex={-1}`, and `scroll-margin-top`
      (student layout; mirror in staff/admin layouts).

## 3. Decorative icons + semantics

- [x] 3.1 `aria-hidden="true"` on all presentational `<svg>` and the priority dot in
      `request-card.tsx`, `appointment-card.tsx`, `lane.tsx`, `theme-toggle.tsx`, and the nav.
- [x] 3.2 Wrap trailing `→` arrows ("Open →", "View all requests →", "Book another…") in an
      `aria-hidden` span so the link text carries the meaning.
- [x] 3.3 Confirm all actions are `<button>` and all navigations `<a>`/`<Link>` (no div/span
      click handlers); fix any found.

## 4. Login form recovery + inputs

- [x] 4.1 On failed submit, move focus to the `role="alert"` box (`tabIndex={-1}` + ref) so the
      error is announced and reachable.
- [x] 4.2 Add `:focus-visible` treatment to the email/password inputs; end the email placeholder
      with `…`.

## 5. Content robustness

- [x] 5.1 `min-w-0` + `line-clamp-2` on request/appointment card titles (long-content safe).
- [x] 5.2 `tabular-nums` on the appointment date-tile day (and any numeric count badge).
- [x] 5.3 `translate="no"` on the `CampusConnect` brand text and `#REQ-<code>` references.

## 6. Codify the workflow (AGENTS.md)

- [x] 6.1 Add a "UI definition-of-done" subsection: match the claude-design mockup (design MCP),
      apply `frontend-design` + `next-best-practices`, pass a `web-design-guidelines` review in
      both light and dark before a UI task is done. Reference the three skills + the design project.
- [x] 6.2 Note it in the roadmap's cross-cutting list.

## 7. Verify

- [x] 7.1 Re-run the `web-design-guidelines` review over the touched files — the earlier findings
      are resolved (or explicitly justified).
- [x] 7.2 `tsc`/lint clean; `next build` succeeds; `/login` still statically prerendered.
- [x] 7.3 Playwright: keyboard-tab the dashboard + login and screenshot the focus rings in **both**
      themes; confirm skip link works and dark native scrollbars render.
