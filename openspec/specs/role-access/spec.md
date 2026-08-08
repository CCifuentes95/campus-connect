# role-access Specification

## Purpose
TBD - created by archiving change auth-role-access. Update Purpose after archive.
## Requirements
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

A signed-in account with no explicit role claim SHALL be treated as `student`. The default is
applied in-app when reading the session (and in `firestore.rules`, student-level access is
ownership-based, not role-based). This remains true now that Cloud Functions are deployed:
the `onUserCreate` trigger that would set a default claim is **deliberately not deployed**,
because it would race with and clobber the claim written by `adminManageUser` when an admin
creates an advisor or staff account. Only `adminManageUser` and `setRole` are deployed.
Advisors and admins carry an explicit claim (see promotion below).

#### Scenario: Account with no claim is a student
- **WHEN** the session is read for an authenticated account that has no role claim
- **THEN** the effective role is `student` and the user reaches the student home `/`

#### Scenario: Console-created account has no claim
- **WHEN** an account is created directly in the Firebase console, with no deployed
  `onUserCreate` trigger to assign a claim
- **THEN** the account has no role claim and is treated as `student` in-app

#### Scenario: Admin-created account keeps its assigned claim
- **WHEN** an admin creates an Advisor or Staff account through `/admin/users`
- **THEN** the `advisor` claim written by `adminManageUser` is not overwritten by any default,
  because `onUserCreate` is not deployed

### Requirement: Admin-only role promotion

An admin SHALL be able to change a user's role among `student`/`advisor`/`admin` using an
admin-only mechanism that writes the custom claim and mirrors `role` onto the profile doc.
Two mechanisms SHALL be available: the `setRole` Admin SDK CLI script
(`functions/src/scripts/setRole.ts`, operator-run), and the in-app `/admin/users` screen backed
by the `adminManageUser` callable Cloud Function. Both SHALL reject non-admin callers. The
`setRole` callable Cloud Function SHALL be deployed alongside `adminManageUser`. Creating a new
`admin`-role account SHALL remain possible only through the CLI script or by promoting an
existing account — the in-app create form does not offer Admin as a role choice. The change
SHALL take effect on the target's next token refresh (forced with `getIdToken(true)`).

#### Scenario: Admin promotes a user to advisor
- **WHEN** an admin sets a user's role to `advisor`
- **THEN** the user's role claim becomes `advisor` and the profile mirror is updated

#### Scenario: Promotion is restricted to admins
- **WHEN** the promotion mechanism is invoked by a non-admin
- **THEN** it is rejected and no claim is changed

#### Scenario: Claim refresh after promotion
- **WHEN** a user's role has been changed and the client forces a token refresh
- **THEN** the new role is reflected in the user's session and access

#### Scenario: In-app promotion via the Cloud Function
- **WHEN** an admin changes a user's role from the `/admin/users/[id]` screen
- **THEN** `adminManageUser` performs the same claim write and profile mirror as the `setRole`
  tool, gated on the caller holding the `admin` claim

#### Scenario: Admin accounts are not creatable from the UI
- **WHEN** an admin opens the in-app create-user form
- **THEN** Admin is not among the offered role choices; a new admin is made by creating a lower
  role and promoting it, or via the CLI script

### Requirement: Role-gated routing and layouts

The system SHALL gate routes and render the top-nav layout by role, matching
`isStaff()` (advisor or admin) and `isAdmin()` in `firestore.rules`. Staff routes SHALL
reject students; admin-only routes SHALL reject non-admins. Each role SHALL see its own
nav variant per `docs/design-brief.md` (student / staff / admin). The admin nav SHALL include
a working "Users" link to `/admin/users`.

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

#### Scenario: Admin nav Users link is live
- **WHEN** an admin views the top nav
- **THEN** a "Users" link is present and navigates to `/admin/users`
