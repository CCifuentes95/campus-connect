# ADR-0004: Host the Next.js app on Vercel; deploy everything via GitHub Actions

Status: Accepted (amends ADR-0003 — hosting is Vercel, not Firebase App Hosting)

## Context

ADR-0003 chose an all-Firebase stack, including **Firebase App Hosting** for the Next.js
SSR app. In practice we want Vercel — Next.js's native platform — for the web tier: faster,
better-understood build/preview DX and first-class Next 16 support. The rest of the backend
(Auth, Firestore, Cloud Functions, FCM) stays on Firebase. We also want deploys driven by
**GitHub Actions** so the two surfaces (web on Vercel, functions+rules on Firebase) ship from
one place, with the Firebase web config injected at build time from GitHub Secrets.

## Decision

- **Host the Next.js app on Vercel.** The backend stays 100% Firebase. Only the hosting of
  the web tier moves off Firebase App Hosting.
- **One GitHub Actions workflow deploys everything** on push to `main`
  (`.github/workflows/deploy.yml`):
  - **Web:** build with the Firebase web config injected from GitHub Secrets, then
    `vercel build` + `vercel deploy --prebuilt --prod` (Vercel CLI, `VERCEL_TOKEN`).
  - **Backend:** `firebase deploy --only functions,firestore` using a `FIREBASE_SERVICE_ACCOUNT`.
- **Inject `NEXT_PUBLIC_FIREBASE_*` at build time.** These are embedded into the client
  bundle by `next build`, so they must be present wherever the build runs — the Action
  exports them from GitHub Secrets. They are not secret, but live there so the build has them.
- **Disable Vercel's native Git auto-deploy.** The Action is the single deploy path (avoids
  double builds).
- **Keep the Firebase Admin SDK off Vercel.** All privileged operations (`onUserCreate`,
  `setRole`, notifications, auto-close) run in Cloud Functions on Firebase. The Vercel app
  uses only the client SDK + `FirebaseServerApp` scoped to the signed-in user, preserving the
  read-free-rules principle. Vercel therefore never needs a service-account key.
- **Node runtime, not Edge,** for any route touching the Firebase SDK (the SDK needs Node APIs).
- **One Firebase project** for the MVP (`.firebaserc` `default`), no dev/prod split yet.

## Consequences

- **Two providers now** (Vercel + Firebase) instead of one — slightly more surface area, and
  the Firebase web config must be kept in sync between local `.env.local`, GitHub Secrets, and
  any Vercel project settings.
- Deploys are reproducible and gated in CI; previews/rollbacks use Vercel's model.
- ADR-0003's "one platform, one console" benefit is partly lost for the web tier; the backend
  keeps it.
- Next 16 + Vercel CLI build specifics must be verified against current Vercel/Next docs at
  implementation time (Next here diverges from older conventions — see `AGENTS.md`).

## Alternatives considered

- **Firebase App Hosting** (original ADR-0003 choice) — keeps everything on one platform, but
  we prefer Vercel's Next DX and CI control. Superseded.
- **Vercel native Git integration (no Actions)** — simplest, but the env injection and the
  functions/rules deploy would live outside the same pipeline; we want one workflow.
- **Split functions into their own repo** — cleaner separation, but more overhead than an MVP
  needs; a single repo with a `functions/` package is simpler.
