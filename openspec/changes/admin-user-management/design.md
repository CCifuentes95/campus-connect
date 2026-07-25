## Context

Account management today is a local Admin SDK script (`functions/src/scripts/setRole.ts`) run
by an operator with `GOOGLE_APPLICATION_CREDENTIALS`. There is no in-app way to create an
account at all, and no self-signup exists anywhere in the web app (`rg
createUserWithEmailAndPassword` → 0 hits; no signup route) — so today every account is born in
the Firebase console.

Relevant existing state, verified in the codebase:

- `functions/src/index.ts` already contains a written-but-**never-deployed** `setRole` `onCall`
  function (line 66) that checks `request.auth?.token.role !== "admin"` and writes both the
  custom claim and the `users/{uid}.role` mirror. The role-change half of this feature is
  therefore already implemented.
- The same file contains `onUserCreate` (line 44), a v1 Auth trigger that unconditionally sets
  `role: "student"` and creates the profile doc.
- Admin routes live at `app/(admin)/admin/<page>/` (e.g. `app/(admin)/admin/reports/page.tsx`);
  the `(admin)` layout already redirects non-admins via `isAdmin(user.role)`.
- The `users/{uid}` rule is `allow create, delete: if false` and
  `allow update: if isSelf(uid) && unchanged('role') && unchanged('uid') && unchanged('email')`
  — a **denylist**, so any field not named there is self-writable by its owner.
- `components/nav/top-nav.tsx` has the admin "Users" link commented out with an explicit
  deferral note citing ADR-0004.

## Goals / Non-Goals

**Goals:**
- Let an admin create a Student/Advisor/Staff account and browse, edit, and hard-delete
  accounts from `/admin/users`, without the Firebase console or a local script.
- Centralize privileged Auth/claims/profile writes behind admin-gated Cloud Functions so the
  Vercel app never touches the Admin SDK (ADR-0004 unchanged).
- Match the two mockups' structure, copy, and tokens per the UI comparison-check process,
  recording justified deviations.

**Non-Goals:**
- No 4th custom-claim value. The claim enum stays `student` | `advisor` | `admin`.
- `cats` and `bookable` are **descriptive metadata only** — they do NOT feed US-04's static
  advising config (`lib/advising.ts`) or US-07's triage-board filtering. Reopening either
  archived spec is out of scope.
- No self-service password reset, no email verification, no bulk import/export, no CSV.
- No audit trail for admin user-management actions (plain field updates, appointments-style,
  not tickets-style `events` docs).
- No "Last active" tracking (see Decisions).

## Decisions

**Advisor vs. Staff is a `staffType` profile field, not a claim value.**
The mockup treats `Advisor` and `Staff` as two distinct `role` values with their own tabs,
tiles, and pill tints, but they have identical permissions in our flat model. Both therefore
write the **`advisor` custom claim**, and a new display-only `staffType: 'advisor' | 'staff'`
field on `users/{uid}` drives the tabs/tiles/pills. `firestore.rules` `isStaff()` is unchanged,
`lib/roles.ts`'s `Role` type is unchanged, the `TopNav` `Record<Role, …>` map is unchanged, and
the `role` mirror stays a faithful copy of the claim. Alternatives rejected: a 4th `staff`
claim (widens `isStaff()`, the `Role` type, the nav map, and the route layouts for zero
permission difference); overloading the `role` mirror with 4 values (breaks the documented
invariant that the mirror equals the claim).

**One new callable, `adminManageUser`, reusing the existing `setRole`.**
`adminManageUser({ action: 'create' | 'update' | 'delete', ... })` — an `onCall` function in
`functions/src/index.ts`, gated on `request.auth?.token.role === 'admin'` **before any write**,
mirroring `setRole`'s existing guard. Role changes delegate to the same claim+mirror logic
`setRole` already implements (extracted to a shared helper); `setRole` itself stays exported
and gets deployed too, since `role-access` already specs it. Alternatives rejected: a Vercel
route handler using the Admin SDK (forbidden by ADR-0004); three separate
create/update/delete functions (needless deploy surface for one shared auth check).

**`onUserCreate` is deliberately not deployed.**
It would fire on `adminManageUser`'s Auth create and race-clobber the `advisor` claim back to
`student`. Since no self-signup exists, nothing needs a default-claim trigger, and a
console-created account with no claim already resolves to `student` in-app
(`lib/firebase/session.ts`). Leaving it undeployed is also the status quo, so this change adds
exactly two deployed functions. Alternatives rejected: making it read-before-write idempotent
(extra code for an unused path, still racy on the profile-doc write); deleting it outright
(touches US-01's shipped scope for no benefit).

**Transport: server action → callable over HTTPS with the session cookie's ID token.**
`lib/actions/admin-users.ts` follows the established `"use server"` + zod + discriminated
`useActionState` result pattern. It invokes the function by POSTing the callable protocol
(`{data: …}` + `Authorization: Bearer <idToken>`) to
`https://us-central1-<project>.cloudfunctions.net/adminManageUser`, reading the ID token from
the same `__session` cookie that seeds `FirebaseServerApp`. That is exactly what the client SDK
sends on the wire, so `request.auth.token.role` populates and the admin gate works.

**This replaces the original plan** — `getFunctions(serverApp)` + `httpsCallable` — which was
tried first against the deployed function and **fails intermittently**. The Functions SDK's
`ContextProvider` does `this.auth = authProvider.getImmediate({optional: true})` and, when that
returns null (as it does under a `FirebaseServerApp`), fills `this.auth` from an **async**
`authProvider.get().then(...)`. The token is therefore attached only if that promise happens to
resolve before `getAuthToken()` runs: most calls threw `unauthenticated`, an occasional one
succeeded. Intermittent auth failure is worse than none, so the transport is now explicit.
The Admin SDK still never runs on Vercel (ADR-0004) — this is the signed-in user's own token,
and the function re-checks the claim.

**New profile fields are additive, and the self-update rule becomes an allowlist.**
`staffType`, `dept`, `cohort`, `studentId`, `cats`, `bookable` join `users/{uid}`. The original
plan was to add each to the existing `unchanged(...)` denylist — **that would have been a bug**:
`unchanged(field)` expands to `request.resource.data[field] == resource.data[field]`, which
errors (and therefore denies) when the field is absent, and none of these fields exist on
student profiles. Students would have been locked out of saving notification preferences.

Instead the rule becomes an allowlist —
`request.resource.data.diff(resource.data).affectedKeys().hasOnly(['notificationPrefs'])` —
matching the pattern already used by the `notifications` subcollection rule in the same file.
`notificationPrefs` is verifiably the only field the client ever writes to `users/{uid}`
(`lib/actions/notifications.ts`). This also needs no maintenance as future admin-managed fields
are added. The Cloud Function writes everything else via the Admin SDK, bypassing rules.

**Category vocabulary is the mockup's six labels verbatim.**
`['Advising','Academic','Records','Finance','IT Support','Career']` — stored as-is, not mapped
onto the ticket `category` enum (`registration | records | financial_aid | advising | it |
other`). The two only partially overlap: `Academic` and `Career` have no ticket equivalent, and
`registration`/`other` have no chip. Since these are descriptive-only, the mockup wins as the
design source of truth; a future change that wires triage filtering will need an explicit
mapping layer, and that cost is deferred to it.

**"Last active" becomes "Joined".**
Last-sign-in lives in Firebase Auth metadata (`UserRecord.metadata.lastSignInTime`), not
Firestore, so the mockup's sortable "Last active" column would force the list read through an
Admin SDK `listUsers()` call — breaking the pattern where every screen reads via
`FirebaseServerApp` under the user's own credentials. Instead the column shows **Joined**, from
the existing `createdAt`. The Students tile's "N not signed in yet" note is dropped with it.
Both are recorded as justified deviations. Alternative rejected: stamping `lastSignInAt` from
`app/api/session/route.ts` on every sign-in (a write per sign-in, and still only approximate).

**List read stays a plain Firestore RSC read.**
`/admin/users` reads `users` ordered by a single field and computes counts, tabs, search, and
sort **in memory**, matching the staff triage board's pattern — no composite index. Admins can
already read all `users` docs (`allow read: if isSelf(uid) || isStaff()`).

**Hard delete.**
Removes the Auth account and the `users/{uid}` doc. Existing denormalized names on
tickets/appointments/events keep history rendering, exactly as the mockup's confirm copy
promises. `adminManageUser` rejects deleting the caller's own uid. Alternative rejected: soft
delete via a `disabled` flag — nothing in the app reads such a flag today.

## Risks / Trade-offs

- **First deployed Cloud Function in this MVP** → needs Blaze billing enabled and a new deploy
  step (CI is web-only today; Functions deploy stays manual like rules). Mitigation: exactly
  two functions deployed; ADR records the departure.
- **Callable auth over `FirebaseServerApp` proved unreliable** (resolved) → `httpsCallable`
  attached the ID token only when an async provider fetch won a race, so calls failed
  intermittently with `unauthenticated`. Replaced with an explicit bearer-token POST of the
  callable protocol; verified across create/update/delete against the deployed function.
- **Hard delete is irreversible** and can orphan an in-flight advisor. Mitigation: self-delete
  guard in the function; the confirm modal reuses the mockup's explicit warning copy.
- **Claim change is not instant** — takes effect on the target's next token refresh, same as
  `setRole` today. Mitigation: the role-change warning banner states this; matches existing
  documented `role-access` behavior.
- **`staffType` can drift from `role`** (e.g. a user demoted to `student` keeping
  `staffType: 'staff'`). Mitigation: `adminManageUser` clears `staffType`/`dept`/`cats`/
  `bookable` when the target role becomes `student`, and clears `program`/`cohort`/`studentId`
  when it becomes staff — the mockup's own create-form behavior.

## Migration Plan

1. Enable the Blaze plan on the Firebase project (manual, one-time, console).
2. Add `adminManageUser`; deploy with
   `firebase deploy --only functions:adminManageUser,functions:setRole` (explicitly **not**
   `--only functions`, which would also deploy `onUserCreate`).
3. Add the six fields to `docs/data-model.md`; extend the `users/{uid}` update denylist in
   `firestore.rules`; deploy with `firebase deploy --only firestore:rules`.
4. Ship the UI + server action; re-enable the nav "Users" link.
5. No data migration — existing `users/{uid}` docs simply lack the new fields, which the UI
   treats as empty/false.

Rollback: revert the PR. The deployed functions can stay (admin-gated, unused) or be removed
with `firebase functions:delete adminManageUser`.

## Open Questions

None. The four decisions that were open (Advisor/Staff modeling, `onUserCreate` handling,
category vocabulary, last-active) are settled above, and the transport question was resolved
empirically against the deployed function.
