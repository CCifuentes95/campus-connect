# admin-user-management Specification

## Purpose
Admin-only management of CampusConnect accounts: listing, searching, filtering, creating,
editing, and hard-deleting users from `/admin/users` and `/admin/users/[id]`. All privileged
work (Firebase Auth account writes, custom claims, profile documents) happens inside the
admin-gated `adminManageUser` callable Cloud Function — the Vercel web tier never holds the
Admin SDK (ADR-0004). The UI presents four roles over a three-value claim enum: Advisor and
Staff share the `advisor` claim and are distinguished by the display-only `staffType` profile
field, so `isStaff()` and the flat role model are unchanged (ADR-0007).

## Requirements

### Requirement: Admin-only access to user management

The `/admin/users` and `/admin/users/[id]` routes SHALL be reachable only by a signed-in user
whose claim is `admin`, enforced by the existing `(admin)` route-group layout. Non-admins SHALL
be redirected to their own role's home rather than shown an in-page denial state.

#### Scenario: Non-admin redirected away
- **WHEN** a signed-in user whose claim is `student` or `advisor` requests `/admin/users` or
  `/admin/users/[id]`
- **THEN** they are redirected to the home route for their role and no user data is rendered

#### Scenario: Admin reaches the roster
- **WHEN** a signed-in admin requests `/admin/users`
- **THEN** the four role-summary tiles, search field, role tabs, and the user table render

### Requirement: Privileged writes go through an admin-gated Cloud Function

Account creation, profile/role edits, and deletion SHALL be performed by the `adminManageUser`
callable Cloud Function, which SHALL verify the caller's claim is `admin` before performing any
Auth, claim, or Firestore write. The Vercel web tier SHALL NOT use the Firebase Admin SDK
(ADR-0004). A server action SHALL invoke the callable and return the standard discriminated
`idle | error{fieldErrors,values} | success` result.

#### Scenario: Non-admin caller rejected
- **WHEN** `adminManageUser` is invoked with a token whose `role` claim is not `admin`
- **THEN** the function throws `permission-denied` and performs no Auth, claim, or Firestore
  write

#### Scenario: Admin creates an account end-to-end
- **WHEN** an admin submits a valid create-user form
- **THEN** `adminManageUser` creates the Firebase Auth account, sets the `role` custom claim,
  and creates the `users/{uid}` profile doc with the submitted fields

#### Scenario: onUserCreate does not interfere
- **WHEN** `adminManageUser` creates an account whose role is Advisor or Staff
- **THEN** the resulting custom claim is `advisor` and is not overwritten with `student`,
  because the `onUserCreate` trigger is not deployed

### Requirement: Role model maps four UI roles onto three claims

The UI SHALL present four roles — Student, Advisor, Staff, Admin. Advisor and Staff SHALL both
resolve to the `advisor` custom claim and be distinguished by a display-only
`staffType: 'advisor' | 'staff'` field on `users/{uid}`. The custom-claim enum SHALL remain
`student` | `advisor` | `admin`, and `isStaff()` in `firestore.rules` SHALL be unchanged.

#### Scenario: Advisor and Staff share a claim
- **WHEN** an admin creates one user as "Advisor" and another as "Staff"
- **THEN** both accounts receive the `role: "advisor"` custom claim, with `staffType` set to
  `advisor` and `staff` respectively

#### Scenario: Profile role mirror stays in sync with the claim
- **WHEN** any account is created or has its role changed
- **THEN** the `users/{uid}.role` field equals the custom claim, and the Advisor/Staff
  distinction is carried only by `staffType`

#### Scenario: Staff member has full staff-tier access
- **WHEN** a user with `staffType: 'staff'` requests a staff route
- **THEN** access is granted identically to a user with `staffType: 'advisor'`, since both hold
  the `advisor` claim

### Requirement: Create user with role-appropriate fields

The create-user flow SHALL offer exactly three role cards — Student, Advisor, Staff (**Admin
SHALL NOT be creatable here**) — and SHALL collect full name, university email, and a password
for every role; `studentId` (auto-generated when blank), `program`, and `cohort` for Student;
and `dept`, `title` (job title), and `cats` (request categories they handle) for Advisor and
Staff. A `bookable` toggle SHALL appear for **Advisor only**. Switching role SHALL reset the
role-specific fields to that role's defaults, and fields belonging to the non-selected branch
SHALL NOT be persisted.

#### Scenario: Student account created
- **WHEN** an admin creates a user with role Student, a programme, and a cohort
- **THEN** the claim is `role: "student"`, and the profile stores `program`, `cohort`, and
  `studentId`, with no `dept`, `title`, `cats`, `staffType`, or `bookable`

#### Scenario: Student ID auto-generated when blank
- **WHEN** an admin creates a Student leaving the Student ID field empty
- **THEN** a student identifier is generated and stored on the profile

#### Scenario: Bookable is Advisor-only
- **WHEN** an admin selects the Staff role card
- **THEN** the bookable toggle is not shown, and the created account stores `bookable: false`

#### Scenario: Admin role not offered
- **WHEN** an admin opens the create-user form
- **THEN** the role choices are Student, Advisor, and Staff only

### Requirement: Create-user input validation

The create form SHALL reject a blank full name, an email that is not well-formed, an email
already belonging to an existing account, and a password shorter than 8 characters. Validation
messages SHALL appear only after the first submit attempt. The password field SHALL offer a
generate action and a show/hide toggle, and generating SHALL reveal the password.

#### Scenario: Short password rejected
- **WHEN** an admin submits the form with a password under 8 characters
- **THEN** the account is not created and a password-length error is shown on the field

#### Scenario: Duplicate email rejected
- **WHEN** an admin submits an email that already has an account
- **THEN** the account is not created and a duplicate-email error is shown

#### Scenario: Generate reveals the password
- **WHEN** an admin activates the generate action
- **THEN** a password is filled in and the field switches to visible text

### Requirement: Roster list with tiles, tabs, search, and sort

`/admin/users` SHALL render four summary tiles (Students, Advisors, Support staff,
Administrators) with counts; five role tabs (Everyone, Students, Advisors, Staff, Admins) each
showing a count; a search field matching name, email, programme/department, and student ID; and
a sortable table with columns Person, Role, Program / department, **Joined**, and Actions.
Counts, filtering, search, and sorting SHALL be computed in memory from a single-field-ordered
Firestore read, requiring no composite index.

#### Scenario: Staff tab filters on staffType
- **WHEN** an admin selects the "Staff" tab
- **THEN** only accounts with the `advisor` claim and `staffType: 'staff'` are listed, and the
  "Advisors" tab lists only those with `staffType: 'advisor'`

#### Scenario: Search narrows the table
- **WHEN** an admin types a name, email, or student-ID fragment into search
- **THEN** only matching rows remain, and the footer reports the shown count out of the total

#### Scenario: Sorting by a column header
- **WHEN** an admin activates a sortable column header
- **THEN** the table re-sorts on that column ascending, and toggles to descending when the same
  header is activated again

#### Scenario: Empty result state
- **WHEN** a search or tab combination matches no accounts
- **THEN** an empty state is shown inviting the admin to clear the search or pick another tab

### Requirement: Edit user profile and role

An admin SHALL be able to edit an existing user's profile fields and change their role — among
Student, Advisor, Staff, and Admin — from `/admin/users/[id]`, through `adminManageUser`.
Changing role SHALL display a warning that access changes and that the change lands on the
target's next token refresh. When a role change moves a user between the student and staff
branches, the fields belonging to the abandoned branch SHALL be cleared.

#### Scenario: Admin promotes a student to advisor
- **WHEN** an admin changes a user's role from Student to Advisor and saves
- **THEN** the custom claim becomes `advisor`, `staffType` becomes `advisor`, the `role` mirror
  is updated, and `program`/`cohort`/`studentId` are cleared

#### Scenario: Role change warns before saving
- **WHEN** an admin changes the role selector on the detail form
- **THEN** a warning about the access change and the token-refresh delay is shown before the
  save is committed

#### Scenario: Role change is not instant for the target
- **WHEN** a user's role has just been changed
- **THEN** their access reflects the new role only after their next token refresh, consistent
  with `role-access`

### Requirement: Hard delete a user account

An admin SHALL be able to permanently delete an account from either the roster row action or
the detail page, after confirming a modal that states the action removes the sign-in
credentials, leaves past requests attributed to a removed user, and cannot be undone. Deletion
SHALL remove the Firebase Auth account and the `users/{uid}` doc. An admin SHALL NOT be able to
delete their own account.

#### Scenario: Admin deletes another user
- **WHEN** an admin confirms deletion of another user's account
- **THEN** the Auth account and the `users/{uid}` doc are deleted and the row disappears from
  the roster

#### Scenario: Historical records survive deletion
- **WHEN** a deleted user was denormalized as `studentName`, `advisorName`, or `actorName` on a
  ticket, appointment, or event
- **THEN** those records continue to display that name unchanged

#### Scenario: Self-delete blocked
- **WHEN** an admin attempts to delete their own account
- **THEN** the function rejects the request and no Auth or Firestore write occurs

### Requirement: New profile fields are not client-writable

The fields `staffType`, `dept`, `cohort`, `studentId`, `cats`, and `bookable` SHALL be writable
only by the Admin SDK context inside `adminManageUser`. The `users/{uid}` self-update rule
SHALL be an **allowlist** restricting client writes to `notificationPrefs` only, rather than a
per-field `unchanged()` denylist — `unchanged(field)` errors and denies when the field is
absent, and these fields do not exist on student profiles.

#### Scenario: User cannot self-assign staffType
- **WHEN** a signed-in student attempts to write `staffType` or `cats` to their own
  `users/{uid}` document from the client
- **THEN** the write is rejected by `firestore.rules`

#### Scenario: Saving notification preferences still works
- **WHEN** a student saves their notification preferences, on a profile document that has none
  of the new admin-managed fields
- **THEN** the write succeeds, because the rule allowlists `notificationPrefs` rather than
  comparing absent fields

#### Scenario: The Cloud Function can write them
- **WHEN** `adminManageUser` writes these fields via the Admin SDK
- **THEN** the write succeeds, because the Admin SDK bypasses security rules

### Requirement: Category and bookable are descriptive metadata only

The `cats` field SHALL store the six mockup labels verbatim — `Advising`, `Academic`,
`Records`, `Finance`, `IT Support`, `Career` — and SHALL NOT be mapped onto the ticket
`category` enum. Neither `cats` nor `bookable` SHALL alter US-04's advising availability or
US-07's triage-board filtering.

#### Scenario: Bookable does not change booking availability
- **WHEN** an admin sets `bookable` to false for an advisor
- **THEN** the student booking wizard's advisor and slot availability is unchanged, still
  driven by the static advising config

#### Scenario: Categories do not change triage filtering
- **WHEN** an admin sets `cats` values on a staff account
- **THEN** the staff triage board's category filtering behaviour is unchanged
