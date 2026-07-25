## Why

Creating and managing staff/student accounts today means an operator running the `setRole`
Admin SDK script by hand against the real Firebase project — "incredibly time consuming" per
the admin, and it's the one piece of US-08's scope that was explicitly deferred (no Cloud
Functions were deployed in the MVP, so the web tier had no way to touch custom claims —
see the deferral note in `components/nav/top-nav.tsx`). Real mockups now exist
(`Users.dc.html`, `User Detail.dc.html`) for an in-app admin screen to create, browse, edit,
and delete accounts, so this closes that gap with a proper (if minimal) privileged backend
instead of a CLI workaround.

## What Changes

- Add `/admin/users` (`app/(admin)/admin/users/page.tsx`): four role-summary tiles, search,
  five role tabs with counts (Everyone/Students/Advisors/Staff/Admins), and a sortable table
  (Person / Role / Program · department / Joined / Actions).
- Add `/admin/users/[id]`: per-user detail with an edit form, role-change warning, account
  meta sidebar, and delete.
- Add a Create-user modal: role cards for Student/Advisor/Staff (**no Admin**), conditional
  student-record vs. advisor/staff-profile fields, category chips, an Advisor-only bookable
  toggle, and a password field with generate + show/hide (min 8 chars).
- **New Cloud Function** `adminManageUser` (`create` | `update` | `delete`) in
  `functions/src/index.ts`, admin-claim-gated, doing Firebase Auth + custom-claim +
  profile-doc writes. This is the **first Cloud Function actually deployed** in this MVP —
  requires the Blaze plan. The existing `setRole` callable (already written at
  `functions/src/index.ts:66`, never deployed) gets deployed alongside it and is reused for
  the claim-write half rather than reimplemented.
- **`onUserCreate` stays undeployed.** It hard-sets `role:"student"` on every new Auth
  account and would clobber an admin-created advisor's claim. Nothing else in the app creates
  accounts (there is no self-signup — no `createUserWithEmailAndPassword`, no signup route),
  so leaving it undeployed is both race-free and the status quo.
- Add profile fields to `users/{uid}`: `staffType`, `dept`, `cohort`, `studentId`, `cats`,
  `bookable` — plus a matching `firestore.rules` change (the existing self-update rule is a
  **denylist** of `unchanged()` fields, so each new field must be added or a user could
  self-edit it).
- Re-enable the admin nav "Users" link (currently commented out with the deferral note).
- **BREAKING**: deleting a user is a hard delete (Firebase Auth account + `users/{uid}` doc).
  Tickets/appointments/events keep their denormalized `studentName`/`advisorName`/`actorName`,
  so historical records still render — matching the mockup's delete copy ("Their past requests
  stay in the system, attributed to a removed user").

## Capabilities

### New Capabilities
- `admin-user-management`: admin-only screens to list, search, filter, create, edit, and
  hard-delete user accounts, backed by a privileged Cloud Function that owns Firebase Auth +
  custom-claim + profile-doc writes.

### Modified Capabilities
- `role-access`: the "Admin-only role promotion" requirement gains a second, in-app mechanism
  (the `/admin/users` UI calling `adminManageUser`) alongside the `setRole` CLI script, and
  records that the `setRole` callable is now deployed while `onUserCreate` deliberately is
  not; the admin nav "Users" link scenario becomes implemented rather than aspirational.

## Impact

- **New**: `adminManageUser` in `functions/src/index.ts`; first `firebase deploy --only
  functions` of this project (needs Blaze).
- **New**: `app/(admin)/admin/users/page.tsx`, `app/(admin)/admin/users/[id]/page.tsx`,
  components under `components/admin/`, and `lib/actions/admin-users.ts`.
- **Changed**: `firestore.rules` (`users/{uid}` update denylist), `docs/data-model.md` (six new
  fields), `components/nav/top-nav.tsx` (re-enable Users link, drop the deferral comment).
- **Changed**: `docs/adr/` — new ADR for deploying Cloud Functions and for the
  claim-vs-`staffType` split.
- **Dependency**: Firebase Blaze billing plan.
- **Deviations from the mockup** (recorded per the UI comparison-check process): the "Last
  active" column becomes **"Joined"** (backed by the existing `createdAt`) because last-sign-in
  lives in Firebase Auth metadata, not Firestore; the Students tile's "N not signed in yet"
  note goes with it; and the mockup's in-page "Admin access required" state is unreachable
  because the `(admin)` route-group layout already redirects non-admins.
