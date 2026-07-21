## Context

US-01 is the first change and the base for the whole build order. It stands up identity
(Firebase Auth), authorization (role custom claims), and the SSR wiring that lets server
components read Firestore under the signed-in user. The Login screen and the three nav
variants already exist in `docs/design-brief.md`; the roles/claims model and the
read-free-rules principle are fixed in `docs/data-model.md`, `firestore.rules`, and
ADR-0001. This design covers how those pieces fit together on Next.js App Router hosted on
**Vercel** (ADR-0004), with Firebase as the backend — not line-by-line code.

## Goals / Non-Goals

**Goals:**
- IBU email/password sign-in matching the Login screen states.
- Role as a custom claim (`student`/`advisor`/`admin`); default `student` on signup;
  admin-only promotion. No Firestore read in `firestore.rules`.
- An SSR session usable by server components via `FirebaseServerApp`.
- Route + layout gating by role (student / staff / admin) consistent with `isStaff()`/
  `isAdmin()`.

**Non-Goals:**
- Self-service registration UI, SSO/SAML, password reset flows (stub the "Forgot?" link).
- Any feature screen beyond Login (dashboards, tickets, advising — later user stories).
- Per-department or per-capability permissions (ADR-0001 keeps roles flat).
- SMS/email delivery of anything (US-06).

## Decisions

- **Identity: Firebase Auth email/password.** Matches the all-Firebase stack (ADR-0003) and
  the Login design (no role picker). *Alternative:* SSO/SAML against IBU IdP — closer to a
  real campus, but out of scope for an MVP and unavailable in this exercise.

- **Role storage: custom claims, read from the token.** Keeps `firestore.rules` read-free
  and low-latency (ADR-0001). The `users/{uid}.role` field is a display mirror only.
  *Alternative:* role in the user doc — forces a billed read in rules on every request and
  risks drift. Rejected.

- **Default role via `onUserCreate`; promotion via admin-only `setRole` callable.** New
  accounts are students; only an admin can elevate. Both run in `functions/` with the Admin
  SDK (bypasses rules by design). `setRole` verifies the caller's `admin` claim server-side.
  Claims propagate on the next token refresh — the client forces `getIdToken(true)` after a
  known change. *Alternative:* let an admin write the claim from the client — impossible
  (setting claims requires the Admin SDK) and unsafe. Rejected.

- **SSR reads via `FirebaseServerApp`.** Server components initialize a per-request
  `FirebaseServerApp` seeded with the user's ID token so Firestore reads run under the
  user's credentials and obey `firestore.rules`. The signed-in ID token is carried to the
  server via a session cookie set at sign-in. Runs on **Node runtime, not Edge** (the Firebase
  SDK needs Node APIs). The **Admin SDK is never used on Vercel** — privileged ops stay in
  Cloud Functions (ADR-0004). *Alternative:* Admin SDK reads on the server — bypasses rules,
  re-implements authorization in app code, and diverges from the read-free-rules principle.
  Rejected.

- **Route gating: role-based route groups + a guard.** App Router route groups
  `app/(student)`, `app/(staff)`, `app/(admin)` each own a layout with the correct nav
  variant; a shared guard (middleware and/or per-layout check) reads the session role and
  redirects: unauthenticated → `/login`, wrong-role → the user's own home. Rules remain the
  real enforcement boundary; route gating is UX. *Alternative:* one layout with conditional
  nav — workable but muddier; route groups keep role concerns separated.

- **Config via env only.** Firebase web config comes from `NEXT_PUBLIC_*` env vars; no
  secrets in client code (project convention).

## Risks / Trade-offs

- **Stale claims after a role change** → the target keeps the old role until their token
  refreshes. Mitigation: force `getIdToken(true)` after `setRole`; document that promotion
  lands on next refresh; keep token lifetime default.
- **Session cookie handling for SSR is the fiddly part** (setting, verifying, refreshing the
  ID token server-side, on Vercel) → follow the current Next 16 (`node_modules/next/dist/docs/`)
  and Firebase `FirebaseServerApp` guidance rather than training-data patterns; verify with the
  emulator.
- **Route gating diverging from rules** → treat `firestore.rules` as the source of truth for
  access; gating only decides which page/nav to render. Any new protected area must add both.
- **No password reset in the MVP** → the "Forgot?" link is a stub; call it out so it isn't
  mistaken for working.
- **Emulator vs deployed drift** (claims, Vercel SSR) → develop and test against the
  Firebase Auth + Functions + Firestore emulators before deploying.

## Migration Plan

Greenfield — no data migration. Rollout: enable Email/Password auth in the Firebase console;
deploy `onUserCreate` + `setRole`; seed one admin (set the `admin` claim manually once via a
script/Admin SDK, since `setRole` itself needs an admin caller); deploy `firestore.rules`;
ship the Login route + role layouts. Rollback: revert the app deploy; functions are additive
and safe to leave. Verify end-to-end on the emulator suite first.

## Open Questions

- **Admin bootstrap:** confirm the mechanism to seed the very first admin (one-off script vs
  console) — everything else flows from `setRole`.
- **Session strategy specifics:** exact cookie/session-refresh approach for App Hosting SSR —
  resolve against current Firebase docs during implementation.
