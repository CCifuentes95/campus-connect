## ADDED Requirements

### Requirement: Semantic theme tokens drive all surface color

The app SHALL define a layer of **semantic color tokens** (role-based, e.g. page background,
surface, ink/heading, body text, muted text, border, accent) that resolve to different values
in light and dark themes. UI components SHALL derive their colors from these semantic tokens
rather than from hardcoded hex values, so a single theme switch restyles the whole surface.
Fixed brand constants (navy, gold, teal) MAY remain as the underlying palette that the semantic
tokens reference.

#### Scenario: A themed component uses tokens

- **WHEN** a refactored component (nav, dashboard card/lane, login) renders
- **THEN** its background, text, and border colors come from semantic tokens, and it contains no
  hardcoded hex color for those roles

#### Scenario: Switching theme restyles without per-component changes

- **WHEN** the active theme changes from light to dark
- **THEN** page background, surfaces, text, borders, and accents all update from the token layer
  without any component needing a separate dark-specific class per element

### Requirement: Dark theme matches the design brief

The dark theme SHALL follow `docs/design-brief.md` `.cc-dark`: a deep page background
(`#081826`), a raised surface (`#0f2942`), light text on dark, and the **gold accent replacing
navy for active/primary states** where navy-on-dark would fail contrast. Text and interactive
elements SHALL remain legible (no navy text on a near-black background).

#### Scenario: Dashboard in dark theme

- **WHEN** the student dashboard renders in dark theme
- **THEN** the page uses the deep background, cards use the raised surface, the greeting and card
  text are light and legible, and primary actions use the gold accent

#### Scenario: No illegible low-contrast text

- **WHEN** any refactored screen renders in dark theme
- **THEN** no heading or body text is rendered in navy (or another dark ink) on the dark
  background

### Requirement: Users can toggle the theme from the top nav

The top nav SHALL present a **theme toggle** on every screen that renders it. Activating it
SHALL switch the app between light and dark immediately by setting a theme marker
(`data-theme` / `.cc-dark`) on the root `<html>` element.

#### Scenario: Toggle flips the theme

- **WHEN** a signed-in user clicks the theme toggle
- **THEN** the app switches between light and dark, and the toggle reflects the now-active theme

### Requirement: Theme choice persists and renders without flash

The selected theme SHALL persist across page loads and navigations via a **cookie**, and the
server SHALL apply it on first render (initial `<html>` marker) so there is **no flash of the
wrong theme** on load. When the user has made no explicit choice, the app SHALL default to the
operating system preference (`prefers-color-scheme`).

#### Scenario: Persisted choice survives reload

- **WHEN** a user has selected dark and reloads or navigates to another route
- **THEN** the app renders in dark from the first paint, with no flash of light first

#### Scenario: OS default before any choice

- **WHEN** a user who has never toggled visits with their OS set to dark
- **THEN** the app renders in dark by default

#### Scenario: The broken partial-dark override is gone

- **WHEN** the OS is set to dark and the user has not chosen a theme
- **THEN** the app renders the complete dark theme (not a page-background-only override that
  leaves light-styled components), i.e. the previous `prefers-color-scheme` bg/fg-only rule no
  longer applies
