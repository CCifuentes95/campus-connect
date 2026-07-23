## ADDED Requirements

### Requirement: Typed flag registry

The system SHALL define a fixed, typed registry of feature flags in a server-only module
(`lib/flags.ts`). Each flag SHALL have a stable name and be backed by a named environment
variable that is **not** a `NEXT_PUBLIC_*` variable (so no flag value is inlined into the
client bundle). The initial registry SHALL include flags for the submit-request,
book-appointment, notifications, and staff-triage flows. Referencing a flag not in the
registry SHALL be a type error.

#### Scenario: Flags are read only on the server

- **WHEN** the project is built
- **THEN** no flag environment variable value appears in the client bundle (flags are backed by
  non-`NEXT_PUBLIC_*` variables read server-side only)

#### Scenario: An unknown flag is a type error

- **WHEN** code calls `isEnabled` with a name not in the registry
- **THEN** the TypeScript build fails

### Requirement: Safe-default enablement

`isEnabled(flag)` SHALL return whether a flag is on. A flag SHALL default to **on** when its
environment variable is unset or unrecognised, and SHALL be off **only** when the variable is
explicitly set to a recognised falsey value (e.g. `"off"` / `"false"` / `"0"`). Absent or
malformed configuration SHALL never disable a shipped feature.

#### Scenario: Unset variable means enabled

- **WHEN** a flag's environment variable is not set
- **THEN** `isEnabled` returns `true` for that flag

#### Scenario: Explicit off disables the flag

- **WHEN** a flag's environment variable is set to a recognised falsey value
- **THEN** `isEnabled` returns `false` for that flag

#### Scenario: Malformed value falls back to enabled

- **WHEN** a flag's environment variable is set to an unrecognised value
- **THEN** `isEnabled` returns `true` (the safe default)

### Requirement: Route-level gating

A flow gated by a flag SHALL check the flag at its route entry (layout or page, a server
component) and, when the flag is off, SHALL make the flow unreachable — redirecting away or
rendering a disabled/"coming soon" state instead of the flow. A gated route SHALL NOT render
its normal content while its flag is off.

#### Scenario: Disabled route is unreachable

- **WHEN** a user navigates to a flagged route whose flag is off
- **THEN** the flow's normal content is not rendered (the user is redirected or shown a
  disabled state)

#### Scenario: Enabled route behaves normally

- **WHEN** a flag is on (including by default)
- **THEN** the gated route renders and behaves exactly as it did before gating was added

### Requirement: Action-level gating

A server action belonging to a flagged flow SHALL check the flag before any write and, when
the flag is off, SHALL perform no write and return an error result the caller can surface.
This SHALL hold even if the route gate was bypassed (e.g. a stale client form posting to the
action).

#### Scenario: Disabled action performs no write

- **WHEN** a flagged server action is invoked while its flag is off
- **THEN** no Firestore write occurs and an error result is returned

#### Scenario: Enabled action writes normally

- **WHEN** a flagged server action is invoked while its flag is on
- **THEN** the action performs its normal write
