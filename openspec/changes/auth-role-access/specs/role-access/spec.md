## ADDED Requirements

### Requirement: Role as a custom claim

A user's role SHALL be one of `student`, `advisor`, or `admin`, stored as a Firebase Auth
custom claim and read from `request.auth.token.role`. Authorization decisions SHALL NOT
require a Firestore document read. The role MAY be mirrored onto the `users/{uid}` profile
doc for display, but the claim SHALL be authoritative.

#### Scenario: Role read from the token
- **WHEN** any access-control check runs for an authenticated request
- **THEN** the role is taken from the ID token claim, with no Firestore read

#### Scenario: Profile mirror is not authoritative
- **WHEN** the `role` field on a `users/{uid}` doc disagrees with the claim
- **THEN** access decisions follow the claim, not the profile field

### Requirement: Default role on account creation

An `onUserCreate` Cloud Function SHALL set the `role: "student"` custom claim on every new
account and create its `users/{uid}` profile document per `docs/data-model.md`.

#### Scenario: New account gets the student role
- **WHEN** a new Firebase Auth account is created
- **THEN** the account receives the `student` role claim and a matching `users/{uid}` profile
  doc is created

### Requirement: Admin-only role promotion

An admin-only callable `setRole` Cloud Function SHALL change a target user's role claim
among `student`/`advisor`/`admin` and mirror it onto the profile doc. Callers without the
`admin` role SHALL be rejected. The change SHALL take effect on the target's next token
refresh (forced with `getIdToken(true)`).

#### Scenario: Admin promotes a user to advisor
- **WHEN** an admin calls `setRole` for a user with role `advisor`
- **THEN** the user's role claim becomes `advisor` and the profile mirror is updated

#### Scenario: Non-admin attempts promotion
- **WHEN** a user without the `admin` role calls `setRole`
- **THEN** the call is rejected and no claim is changed

#### Scenario: Claim refresh after promotion
- **WHEN** a user's role has been changed and the client forces a token refresh
- **THEN** the new role is reflected in the user's session and access

### Requirement: Role-gated routing and layouts

The system SHALL gate routes and render the top-nav layout by role, matching
`isStaff()` (advisor or admin) and `isAdmin()` in `firestore.rules`. Staff routes SHALL
reject students; admin-only routes SHALL reject non-admins. Each role SHALL see its own
nav variant per `docs/design-brief.md` (student / staff / admin).

#### Scenario: Student blocked from staff routes
- **WHEN** a user with the `student` role requests a staff route (e.g. `/staff/triage`)
- **THEN** access is denied and the user is redirected to their own home

#### Scenario: Advisor allowed on staff routes but not admin routes
- **WHEN** a user with the `advisor` role requests a staff route
- **THEN** access is granted; **AND WHEN** the same user requests an admin-only route
  (e.g. `/admin/reports`) access is denied

#### Scenario: Correct nav variant per role
- **WHEN** an authenticated user loads any in-app page
- **THEN** the top nav shows the variant for their role (student: Dashboard/Requests/
  Appointments; staff: Triage board/My requests/Appointments/Reports; admin: Dashboard/
  Triage board/Reports/Users)
