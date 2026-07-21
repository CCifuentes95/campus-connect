## 1. Firebase project & local setup

- [ ] 1.1 Enable Email/Password sign-in in the Firebase console (one project, per ADR-0004)
- [ ] 1.2 Create the Vercel project, link the repo, and DISABLE Vercel's native Git auto-deploy (the Action is the deploy path)
- [ ] 1.3 Add the GitHub repo secrets from `.github/workflows/deploy.yml` (Vercel token/org/project, `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT`); set the real project id in `.firebaserc` + the workflow
- [x] 1.4 Add Firebase web config to `.env.local` from `.env.example` (no secrets in client code)
- [ ] 1.5 Confirm the Firebase Emulator Suite runs (`firebase.json` already configured) and wire the app to it via env flags
- [ ] 1.6 Deploy `firestore.rules` to the emulator/project and confirm `isStaff()`/`isAdmin()` resolve from the token

## 2. Firebase client & SSR wiring (`lib/firebase/`)

- [x] 2.1 Create the client Firebase app init (`lib/firebase/client.ts`) from env config
- [x] 2.2 Add `FirebaseServerApp` setup (`lib/firebase/server.ts`) that seeds a per-request app from the user's ID token
- [x] 2.3 Implement the session bridge: set a session cookie at sign-in, read/verify it server-side, expose the ID token to server components
- [x] 2.4 Add a `getCurrentUser()`/session helper for server components returning uid + role (from the token)

## 3. Cloud Functions (`functions/`)

- [x] 3.1 Implement `onUserCreate`: set default `role: "student"` claim and create the `users/{uid}` profile doc per `docs/data-model.md`
- [x] 3.2 Implement admin-only `setRole` callable: verify caller `admin` claim, set target role claim, mirror `role` onto the profile doc
- [x] 3.3 Add a one-off admin-bootstrap script/step to set the first `admin` claim (resolves the Open Question)
- [ ] 3.4 Unit-test the functions against the emulator (default student on create; setRole rejects non-admins; mirror updated)

## 4. Login screen (`app/login/`)

- [x] 4.1 Build the Login route + UI from `docs/design-brief.md` (split brand panel, email/password, show-hide, keep-signed-in, theme toggle)
- [x] 4.2 Validate input with zod at the boundary; wire the sign-in action to Firebase Auth
- [x] 4.3 Handle all states: success redirect, wrong password, no account found, access-denied (valid IBU account without a CampusConnect role → sign out + message)
- [x] 4.4 Implement "Keep me signed in" persistence toggle; stub the "Forgot?" link (mark as non-functional for the MVP)
- [x] 4.5 Implement sign-out (clears session; protected routes then redirect to `/login`)

## 5. Role-gated routing & layouts

- [x] 5.1 Create route groups `app/(student)`, `app/(staff)`, `app/(admin)` with per-group layouts
- [x] 5.2 Build the three top-nav variants (student / staff / admin) per `docs/design-brief.md`, with theme toggle and user chip
- [x] 5.3 Add the guard (middleware and/or per-layout check): unauthenticated → `/login`; wrong role → the user's own home
- [x] 5.4 Redirect authenticated users from `/login` to their role home (student `/`, staff `/staff/triage`, admin `/admin/reports`)

## 6. Verification

- [ ] 6.1 Emulator end-to-end: new signup defaults to student; admin promotes to advisor/admin; token refresh reflects the new role
- [ ] 6.2 Verify a server component reads Firestore via `FirebaseServerApp` under the user and is subject to `firestore.rules`
- [ ] 6.3 Verify route gating: student blocked from staff/admin routes; advisor allowed on staff but not admin routes
- [ ] 6.4 Run `openspec validate --change auth-role-access` and confirm the change is apply-ready
