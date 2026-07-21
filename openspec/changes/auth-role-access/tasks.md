## 1. Firebase project & local setup

- [x] 1.1 Enable Email/Password sign-in in the Firebase console (one project, per ADR-0004)
- [ ] 1.2 Create the Vercel project, link the repo, and DISABLE Vercel's native Git auto-deploy (the Action is the deploy path)
- [ ] 1.3 Add the GitHub repo secrets from `.github/workflows/deploy.yml` (Vercel token/org/project, `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT`); set the real project id in `.firebaserc` + the workflow
- [x] 1.4 Add Firebase web config to `.env.local` from `.env.example` (no secrets in client code)
- [x] 1.6 Deploy `firestore.rules` to the project; `isStaff()`/`isAdmin()` resolve from the token

## 2. Firebase client & SSR wiring (`lib/firebase/`)

- [x] 2.1 Create the client Firebase app init (`lib/firebase/client.ts`) from env config
- [x] 2.2 Add `FirebaseServerApp` setup (`lib/firebase/server.ts`) that seeds a per-request app from the user's ID token
- [x] 2.3 Implement the session bridge: set a session cookie at sign-in, read/verify it server-side, expose the ID token to server components
- [x] 2.4 Add a `getCurrentUser()`/session helper for server components returning uid + role (from the token)

## 3. Role management (`functions/` — Admin SDK, not deployed in the MVP)

The MVP does not deploy Cloud Functions or run the emulator. Default-student is applied
in-app (see §2/§6); role management uses the `setRole` Admin SDK script run by an operator.
The trigger/callable code is retained for when Functions are deployed (US-06, auto-close).

- [x] 3.1 `onUserCreate` implemented (default `student` claim + profile doc) — code retained, not deployed
- [x] 3.2 `setRole` implemented (verify caller `admin`, set claim, mirror profile) — as the Admin SDK script `functions/src/scripts/setRole.ts`
- [x] 3.3 First-admin bootstrap via the `setRole` script

## 4. Login screen (`app/login/`)

- [x] 4.1 Build the Login route + UI from `docs/design-brief.md` (split brand panel, email/password, show-hide, keep-signed-in, theme toggle)
- [x] 4.2 Validate input with zod at the boundary; wire the sign-in action to Firebase Auth
- [x] 4.3 Handle sign-in states: success redirect, wrong password, no account found (no "access denied" — a valid account with no claim signs in as student)
- [x] 4.4 Implement "Keep me signed in" persistence toggle; stub the "Forgot?" link (mark as non-functional for the MVP)
- [x] 4.5 Implement sign-out (clears session; protected routes then redirect to `/login`)

## 5. Role-gated routing & layouts

- [x] 5.1 Create route groups `app/(student)`, `app/(staff)`, `app/(admin)` with per-group layouts
- [x] 5.2 Build the three top-nav variants (student / staff / admin) per `docs/design-brief.md`, with theme toggle and user chip
- [x] 5.3 Add the guard (middleware and/or per-layout check): unauthenticated → `/login`; wrong role → the user's own home
- [x] 5.4 Redirect authenticated users from `/login` to their role home (student `/`, staff `/staff/triage`, admin `/admin/reports`)

## 6. Verification

- [x] 6.1 Verify (Playwright, real project): a no-claim account signs in as student; `setRole` promotes to advisor/admin; new role reflected after re-login
- [ ] 6.2 Verify a `FirebaseServerApp` server read runs under the user and obeys `firestore.rules` — first exercised by US-02's dashboard reads
- [x] 6.3 Verify route gating: student blocked from staff/admin routes; advisor allowed on staff but not admin routes
- [x] 6.4 Run `openspec validate --change auth-role-access` and confirm the change is apply-ready
