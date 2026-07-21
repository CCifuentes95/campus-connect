## Why

CampusConnect serves three audiences — students, staff/advisors, and admins — from one
portal, and every other feature (dashboards, tickets, advising, reporting) depends on
knowing *who* is signed in and *what* they may do. US-01 establishes that base: IBU
sign-in, a role for each account, and role-gated access. Nothing else can be built or
tested safely until this exists.

## What Changes

- Add **Firebase Auth** email/password sign-in wired to the Login screen
  (`docs/design-brief.md`): IBU email + password, show/hide, keep-signed-in, and the
  error states (wrong password, access denied, no account found). No role picker — role is
  derived from the account.
- Add an **`onUserCreate` Cloud Function** that, for every new account, sets the default
  `role: "student"` custom claim and creates the `users/{uid}` profile doc (per
  `docs/data-model.md`).
- Add an **admin-only `setRole` callable** Cloud Function that promotes/demotes a user's
  `role` claim (`student` / `advisor` / `admin`) and mirrors it onto the profile doc.
- Read the role from `request.auth.token.role` — **no Firestore lookup** — so
  `firestore.rules` stays read-free (`isStaff()`, `isAdmin()` already encoded).
- Establish **session handling for SSR**: a signed-in session usable by server components
  reading Firestore through **`FirebaseServerApp`** under the user's credentials.
- Add **role-gated routing and layouts**: unauthenticated users are sent to `/login`;
  authenticated users land on their role's home with the correct top-nav variant (student /
  staff / admin). Staff routes reject students; admin routes reject non-admins. Claims
  refresh on the next token refresh (force with `getIdToken(true)` after a role change).

## Capabilities

### New Capabilities
- `authentication`: IBU email/password sign-in and sign-out, the Login screen states, and
  an SSR-usable session that lets server components read Firestore via `FirebaseServerApp`
  under the signed-in user.
- `role-access`: role as a custom claim (`student`/`advisor`/`admin`), default-student on
  signup via `onUserCreate`, admin-only `setRole` promotion, and role-gated routing/layouts
  matching `isStaff()`/`isAdmin()` in `firestore.rules`.

### Modified Capabilities
<!-- None — this is the first change; no existing specs to modify. -->

## Impact

- **New code:** `lib/firebase/` (client + `FirebaseServerApp` setup, session helpers),
  `app/login/` (route + Login UI), `app/(student|staff|admin)/` route groups with role
  layouts, middleware/guard for redirects, `functions/` (`onUserCreate`, `setRole`).
- **Config:** Firebase web config via env only (no secrets in client), injected at build
  time; Auth enabled in the Firebase console; SSR on **Vercel** (ADR-0004).
- **Depends on:** `docs/data-model.md` (users + claims), `firestore.rules` (isStaff/isAdmin).
- **Downstream:** every later user story (US-02…US-08) consumes the session + role gating
  introduced here.
