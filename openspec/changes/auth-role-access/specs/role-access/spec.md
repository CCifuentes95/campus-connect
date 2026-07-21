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

### Requirement: Student is the default role

A signed-in account with no explicit role claim SHALL be treated as `student`. The MVP does
not deploy Cloud Functions, so the default is applied in-app when reading the session (and in
`firestore.rules`, student-level access is ownership-based, not role-based). Advisors and
admins carry an explicit claim (see promotion below).

#### Scenario: Account with no claim is a student
- **WHEN** the session is read for an authenticated account that has no role claim
- **THEN** the effective role is `student` and the user reaches the student home `/`

### Requirement: Admin-only role promotion

An admin SHALL be able to change a user's role among `student`/`advisor`/`admin` using an
admin-only mechanism that writes the custom claim and mirrors `role` onto the profile doc.
For the MVP this is the `setRole` Admin SDK tool run by an operator; a callable Cloud Function
MAY replace it once Functions are deployed. The change SHALL take effect on the target's next
token refresh (forced with `getIdToken(true)`).

#### Scenario: Admin promotes a user to advisor
- **WHEN** an admin sets a user's role to `advisor`
- **THEN** the user's role claim becomes `advisor` and the profile mirror is updated

#### Scenario: Promotion is restricted to admins
- **WHEN** the promotion mechanism is invoked by a non-admin
- **THEN** it is rejected and no claim is changed

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
