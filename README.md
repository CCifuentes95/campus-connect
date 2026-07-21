# CampusConnect

Student support portal MVP for **International Business University (IBU)**. Students request
academic support, book advising appointments, track request status, and get reminders; staff
triage and work requests; admins see reporting.

> Academic exercise — favors pragmatic, shippable choices over infrastructure for its own sake.

## Stack

- **Next.js 16** (App Router, TypeScript) hosted on **Vercel** (SSR).
- **Firebase** backend: Auth (role via custom claims), Firestore, Cloud Functions, FCM.
- **Tailwind v4**. Admin SDK stays in Cloud Functions — never on the web tier (ADR-0004).

## Roles

Flat model: `student`, `advisor`, `admin`. `advisor` and `admin` are one working (staff) tier;
`admin` is a superset (staff screens + reporting + role management). Role lives in a Firebase
custom claim and is read from the token — no Firestore lookup (ADR-0001).

## Getting started

```bash
pnpm install
cp .env.example .env.local     # then fill in the Firebase web config (see below)
pnpm dev                       # http://localhost:3000
```

The app runs locally but talks to the **real Firebase project** (`campus-connect-503020`);
no deploy is needed for local development.

### Environment

`.env.local` (gitignored) holds the Firebase **web** config (`NEXT_PUBLIC_FIREBASE_*`). These
are public client identifiers, not secrets — access is enforced by `firestore.rules` + Auth.
See `.env.example` for the full list. In CI the same values come from GitHub Secrets.

## Testing login locally

Sign-in requires each user to have a role claim (claims can only be set with the Admin SDK):

1. Firebase console → **Authentication** → enable Email/Password, and **Add user**(s).
2. Firebase console → **Project settings → Service accounts → Generate new private key**;
   save it as `service-account.json` in the repo root (gitignored).
3. Grant a role (build the functions first with `npm --prefix functions run build`):
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json FIREBASE_PROJECT_ID=campus-connect-503020 \
     node functions/lib/scripts/setRole.js someone@ibu.edu student   # or advisor | admin
   ```
4. `pnpm dev` → http://localhost:3000/login → sign in. You land on your role's home
   (student `/`, staff `/staff/triage`, admin `/admin/reports`) and are gated to it.

For a fully-offline flow, `pnpm emulators` + `pnpm seed` seed three role users into the
Firebase Emulator Suite (set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` in `.env.local`).

## Project structure

```
app/                  # App Router: (student)|(staff)|(admin) route groups, login, api/session
components/           # UI (auth provider, nav, sign-out)
lib/firebase/         # client + FirebaseServerApp (SSR) + session helpers
lib/roles.ts          # shared role helpers
proxy.ts              # Next 16 request guard (optimistic auth redirect)
functions/            # Cloud Functions (onUserCreate, setRole) + dev scripts
firestore.rules       # claim-driven access control
firestore.indexes.json
docs/                 # data-model.md, design-brief.md, adr/
openspec/             # spec-driven change workflow (see below)
.github/workflows/    # one workflow: web -> Vercel, functions+rules -> Firebase
```

## Docs (source of truth)

- `docs/data-model.md` — collections, fields, indexes, status workflow.
- `docs/design-brief.md` — screen-by-screen UI spec + IBU brand.
- `firestore.rules` — access control (pair any data-model change with a rules change).
- `docs/adr/` — key decisions (flat roles; resolved-vs-closed + auto-close; all-Firebase
  backend; Vercel hosting + GitHub Actions).

## Spec-driven workflow (OpenSpec)

Work is planned as OpenSpec changes under `openspec/changes/<name>/` (proposal → design →
specs → tasks), implemented against the specs, then archived into `openspec/specs/`. See
`AGENTS.md` for full project context and conventions.

Build order: US-01 auth ✅ → US-02 student dashboard → US-03 submit request → US-05 track
ticket → US-04 book advising → US-06 notifications → US-07 triage board → US-08 admin reporting.

## Deployment

One GitHub Actions workflow (`.github/workflows/deploy.yml`) on push to `main`: builds and
deploys the web app to **Vercel** (Firebase web config injected from GitHub Secrets) and
deploys `functions` + Firestore rules/indexes to **Firebase**. Requires the repo secrets
listed in the workflow, a Vercel project (with its native Git auto-deploy disabled), and a
`FIREBASE_SERVICE_ACCOUNT`.
