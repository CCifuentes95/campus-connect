## ADDED Requirements

### Requirement: Interactive elements have a visible keyboard focus indicator

Every interactive element (links, buttons, inputs, the theme toggle, card actions) SHALL show a
visible focus indicator when focused via keyboard, using `:focus-visible` (not `:focus`, to avoid
a ring on mouse click). No element SHALL remove the outline without providing a replacement.

#### Scenario: Tabbing through the dashboard

- **WHEN** a keyboard user tabs through the student dashboard
- **THEN** each focused link, button, and the theme toggle shows a clearly visible focus ring, and
  focus order follows the visual order

#### Scenario: Focus ring only for keyboard

- **WHEN** a user clicks a button with the mouse
- **THEN** no focus ring appears; the ring appears only on keyboard focus (`:focus-visible`)

### Requirement: Decorative icons are hidden from assistive tech; meaningful controls are labelled

Icons that convey no information beyond adjacent text (status/priority glyphs, clock, calendar,
message, plus, trailing arrows) SHALL be `aria-hidden="true"`. Icon-only controls SHALL have an
`aria-label`. Actions use `<button>`; navigation uses `<a>`/`<Link>` — never a `<div>`/`<span>`
with a click handler.

#### Scenario: Screen reader on a request card

- **WHEN** a screen reader reads a request card
- **THEN** it announces the priority, status, title, category, and "Open" without reading
  decorative SVG/dot markup, and "Open" is a link

#### Scenario: Icon-only theme toggle

- **WHEN** a screen reader focuses the theme toggle
- **THEN** it announces a label describing the action (e.g. "Switch to dark theme"), and the inner
  sun/moon icon is not announced

### Requirement: The document declares its color scheme and theme color

The root `<html>` SHALL declare `color-scheme` matching the active theme so native controls
(scrollbars, form controls, inputs) render correctly in dark mode, and the page SHALL provide a
`<meta name="theme-color">` matching the page background.

#### Scenario: Dark theme native controls

- **WHEN** the app renders in the dark theme
- **THEN** `color-scheme: dark` is in effect and native scrollbars/inputs render dark, not light

### Requirement: Keyboard users can skip to main content

Each page SHALL provide a skip link that moves focus to the main content region, and the main
content SHALL be a landmark (`<main>`).

#### Scenario: Skip repeated nav

- **WHEN** a keyboard user presses Tab on page load
- **THEN** a "Skip to content" link is focusable first and, when activated, moves focus past the
  nav to the main content

### Requirement: Forms guide and recover, and inputs are keyboard- and paste-friendly

Form controls SHALL have labels, correct `type`/`inputmode`/`autocomplete`, and MUST NOT block
paste. On a failed submit, focus SHALL move to the first error (or the error alert), which SHALL
be announced. The submit control stays enabled until the request starts and then shows a
progress state.

#### Scenario: Failed sign-in

- **WHEN** sign-in fails
- **THEN** the error alert is announced and focus moves to it (or the first invalid field), so a
  keyboard/screen-reader user learns the outcome without hunting for it

### Requirement: Content handles real-world length, numbers, and untranslatable tokens

Text containers SHALL handle short, average, and very long content (`truncate`/`line-clamp`/
`break-words`, with `min-w-0` on flex children). Numeric tiles/columns SHALL use tabular figures.
Brand names and code tokens (e.g. `#REQ-2041`) SHALL be marked `translate="no"`. Headings SHOULD
use balanced wrapping.

#### Scenario: A very long request title

- **WHEN** a ticket title is much longer than its card
- **THEN** the card clamps/wraps the title without breaking the layout or overflowing its lane

### Requirement: Motion respects the reduced-motion preference

Any transition or animation SHALL be disabled or reduced when the user has
`prefers-reduced-motion: reduce`, and transitions SHALL animate specific properties (never
`transition: all`).

#### Scenario: Reduced-motion user

- **WHEN** a user with `prefers-reduced-motion: reduce` hovers a card
- **THEN** the hover shadow change is removed or near-instant, with no animated movement

### Requirement: UI is built and reviewed against the design skills and mockups

Building or changing any screen SHALL (1) match the corresponding **claude-design** mockup where
one exists (retrieved via the design MCP), (2) apply the `frontend-design` and
`next-best-practices` skills, and (3) pass a `web-design-guidelines` review in **both light and
dark** themes before the UI work is considered done. This definition-of-done SHALL be recorded in
`AGENTS.md`.

#### Scenario: Finishing a new screen

- **WHEN** a UI story (US-03…US-08) is implemented
- **THEN** it is checked against its claude-design mockup and passes a web-design-guidelines
  review in both themes before the tasks are marked complete, per the DoD in AGENTS.md

#### Scenario: No mockup exists yet

- **WHEN** a screen has no claude-design mockup
- **THEN** the `frontend-design` skill guides the visual direction, and the guidelines review +
  both-theme check still apply
