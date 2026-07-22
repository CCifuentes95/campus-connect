<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CampusConnect — project context

Student support portal MVP for **International Business University (IBU)**. Students
request academic support, book advising appointments, track request status, and get
reminders; staff triage and work requests; admins see reporting. Built as an academic
exercise, so favor pragmatic, shippable choices over infrastructure for its own sake.

## Stack

- **Next.js** (App Router, TypeScript) hosted on **Vercel** (SSR). See ADR-0004.
- **Firebase Auth** for identity; **role via custom claims** (`student` / `advisor` / `admin`).
- **Firestore** as the database (no SQL/Postgres).
- **Cloud Functions** for privileged/back-end logic; **FCM** for push notifications.
- The **backend** is all Firebase; only the **web app** is hosted on Vercel (Next's native
  platform). The Admin SDK stays in Cloud Functions — never on Vercel (ADR-0004).
- **Deploy:** a GitHub Actions workflow (`.github/workflows/deploy.yml`) ships the **web app
  to Vercel** on push to `main` (Firebase web config injected from GitHub Secrets). Firestore
  rules deploy **manually** (`firebase deploy --only firestore`); Cloud Functions are **not
  deployed** in the MVP. One Firebase project. See "Implementation notes & gotchas" below.

## Architecture principles

- **Server actions over route handlers** for mutations. Validate input with **zod** at the boundary.
- In server components, read Firestore through **`FirebaseServerApp`** so security rules
  apply under the signed-in user's credentials.
- **Roles come from custom claims**, not a Firestore lookup, so rules stay read-free. A
  signed-in account with no claim is treated as **`student` by default (applied in-app)** —
  the MVP does **not** deploy Cloud Functions. Advisors/admins carry an explicit claim set
  by the **`setRole` Admin SDK tool** (`functions/src/scripts/setRole.ts`). Claims refresh on
  the next token refresh — force with `getIdToken(true)`.
- **Status transitions live in a plain `{ from: [allowed...] }` map in a server action**,
  not a state-machine library. Every transition writes an `events` doc (audit).
- **Denormalize display names** (studentName, advisorName, actorName) onto tickets,
  appointments, and events so read-heavy views never fan out — Firestore has no joins.
- Keep it flat and simple. Don't add a service/library until a real read or rule needs it.

## Roles (flat model)

`advisor` and `staff` are **one working tier** — an advisor is a staff member who also
owns advising appointments. Any staff member can triage, claim, reassign, and unassign.
`admin` is a **superset**: every staff screen plus reporting and role management. This is
what `firestore.rules` already encodes (`isStaff()` = advisor or admin).

## Ticket status workflow

new → assigned → waiting_for_student → resolved → closed

- Status is **never set directly** — it's the result of a named action (Claim & triage,
  Request info, Mark resolved, Close), each of which captures its required input.
- waiting_for_student → assigned when the student replies. resolved → assigned to reopen.
- `resolved` = staff-done-pending-confirmation (reopenable); `closed` = terminal.
  Resolved tickets **auto-close** after N days of no reply via a scheduled Cloud Function.

## Data model & rules (source of truth)

Read these before touching data or auth — do not restate them, follow them:

- `docs/data-model.md` — collections, fields, denormalization, indexes, roles/claims setup.
- `firestore.rules` — access control; **any data-model change must be paired with a rules change.**

Collections: `users` (+ `notifications`, `fcmTokens` subcollections), `tickets`
(+ `events` audit subcollection), `appointments`.

## Before Any Task

**Context Checklist:**
- [ ] Read relevant specs in `specs/[capability]/spec.md`

## Build order

Build the student spine first — it's a working vertical slice — then layer the rest:

1. US-01 auth + role-based access
2. US-02 student dashboard
3. US-03 submit support request
4. US-05 track ticket status
5. US-04 book advising appointment
6. US-06 notifications + preferences
7. US-07 advisor/staff triage board
8. US-08 admin reporting dashboard

## Design & brand

- `docs/design-brief.md` — screen-by-screen UI spec and the IBU brand.
- Colors: navy `#0d2c49` (primary), gold `#d7a524` (accent — never small text on white,
  fails contrast), teal `#064948` (secondary), white background, `#b6c6d5` muted.
- Type: geometric sans (Poppins/Montserrat as a free stand-in for the licensed Visby CF).

## Suggested structure

    app/                 # routes, server components, server actions
    components/           # UI
    lib/firebase/        # client + FirebaseServerApp setup
    lib/actions/         # server actions (mutations, status transitions)
    functions/           # Cloud Functions: onUserCreate, setRole, notifications, auto-close
    docs/                # data-model.md, design-brief.md, adr/
    firestore.rules

## Conventions

- TypeScript strict. No secrets in client code — Firebase web config via env only.
- Record real decisions as ADRs in `docs/adr/` (Context → Decision → Consequences →
  Alternatives). Open ones worth writing: flat vs two-tier roles, resolved-vs-closed +
  auto-close, all-Firebase over Postgres.
- Reporting KPIs may be precomputed/seeded for the MVP — Firestore has no `GROUP BY`.

## Implementation notes & gotchas (learned — read before touching auth/deploy)

**Next.js 16 divergences (this is NOT the Next.js you know):**
- `middleware` was renamed to **`proxy`** — the request guard is `proxy.ts` at the repo root
  (Node runtime by default; you **cannot** set `runtime` inside it). It's optimistic only
  (redirect by cookie presence); real authorization is `firestore.rules` + the route-group layouts.
- `cookies()`, `headers()`, `params`, `searchParams` are **async — you must `await` them**.
- Role gating uses route groups `app/(student|staff|admin)/` with per-group `layout.tsx` that
  read the session and redirect on wrong role.
- Keep the client boundary at the **leaves**: `app/login/page.tsx` is a server component
  (metadata + static brand panel) and only `login-form.tsx` is `"use client"`, so `/login`
  prerenders static. Split pages this way.

**Firebase auth on Vercel (SSR):**
- Server components read Firestore via **`FirebaseServerApp`** (`lib/firebase/server.ts`),
  seeded from an httpOnly `__session` cookie. The client posts its ID token to
  `app/api/session/route.ts`; `components/auth/auth-provider.tsx` keeps it fresh via
  `onIdTokenChanged`. The **Admin SDK is never used on Vercel** (ADR-0004).
- **CRITICAL cookie-race:** after setting/clearing the session cookie, navigate with
  **`window.location.assign` (full navigation), NOT `router.replace`**. A soft client nav
  does not carry the just-set httpOnly cookie into the RSC request, so every role bounces
  back to `/login`. (Matches Firebase's own Next.js sample.)

**Roles / claims:**
- Custom claims are settable **only via the Admin SDK** — use `functions/src/scripts/setRole.ts`
  (`node functions/lib/scripts/setRole.js <email> <role>` with `GOOGLE_APPLICATION_CREDENTIALS`).
- A signed-in account with **no claim defaults to `student` in-app** (`lib/firebase/session.ts`,
  `login-form.tsx`) — there is no "access denied". This is safe because student access in
  `firestore.rules` is **ownership-based** (`studentId == uid`), not role-based.

**CI / deploy traps:**
- pnpm in GitHub Actions needs `"packageManager": "pnpm@…"` in `package.json`.
- The root `tsconfig.json` must **exclude `functions/`** (it has its own toolchain) or the web
  job's `tsc` fails on `firebase-admin` imports.
- CI is **web-only** (deploys to Vercel). Deploy Firestore rules **manually**
  (`firebase deploy --only firestore`) — Functions need the Blaze plan, and a CI `firestore`
  deploy 403s (`serviceusage`) because the `firebase-adminsdk` service account lacks that IAM.
- The Firebase **web `apiKey` is public** (safe in the client bundle / repo) — not a secret.
  **`service-account.json` IS a secret** — it's gitignored; never commit it.
- Vercel deploy via CLI needs GitHub secrets `VERCEL_TOKEN` / `VERCEL_ORG_ID` /
  `VERCEL_PROJECT_ID` (the `ORG_ID` is the project's `accountId`, readable from the Vercel API).
  Disable Vercel's native Git auto-deploy so the Action is the only deploy path.

**`NEXT_PUBLIC_*` are inlined at BUILD time (bit us — "API key not valid"):**
- `next build` bakes `NEXT_PUBLIC_*` into the client bundle. A build run with placeholder env
  (e.g. `NEXT_PUBLIC_FIREBASE_API_KEY=x` for a quick compile check) ships `apiKey:"x"`; a
  `next start` serving that `.next` makes **every** browser sign-in 400 with *"API key not
  valid"* while the same key works via curl. Only ever `next build` with the real `.env.local`,
  and use `next dev` for iterating. Debug order: REST probe the key (below) → if valid, capture
  the **key the browser actually sends** (Playwright on the identitytoolkit request) →
  `grep -r 'apiKey:"' .next` to see what's baked.

**Firestore composite indexes must be DEPLOYED, not just declared:**
- Declaring a composite index in `firestore.indexes.json` is not enough — a query needing it
  throws `failed-precondition` ("The query requires an index…") until you
  `firebase deploy --only firestore:indexes`. Data reads should render an **error** state
  distinct from **empty** so an undeployed index doesn't masquerade as "no data" (US-02 does).

**Theming (light/dark — see the `dark-mode-theming` change):**
- `app/globals.css` defines **semantic role tokens** (`--page`, `--card`, `--inset`, `--ink`,
  `--body`, `--line`, `--accent`, `--teal-ink`, `--tile`, …) in `:root`, flipped under
  `:root[data-theme="dark"]`, and registered via `@theme inline` so utilities (`bg-page`,
  `text-ink`, `border-line`, …) restyle from one root marker. **Use these tokens, not raw hex or
  fixed brand utilities**, on new UI. Fixed brand constants (`navy/gold/teal`) stay for the
  always-dark nav and gold CTAs.
- No-flash SSR: a tiny pre-paint script in `app/layout.tsx` (`lib/theme.ts` `NO_FLASH_SCRIPT`)
  sets `data-theme` from the `cc-theme` cookie → else OS `prefers-color-scheme`, **client-side**
  so `/login` stays statically prerendered. The nav toggle persists via the cookie;
  `<html suppressHydrationWarning>`; the toggle reads the attribute via `useSyncExternalStore`.
- **Finish-feature precheck:** verify every UI feature in **both light and dark** before calling
  it done (screenshot/Playwright).

**UI definition-of-done (skills + mockups — see the `ui-quality-baseline` change):**
Building or changing any screen is not done until it has:
1. **Matched its `claude-design` mockup** where one exists — pull it via the design MCP
   (`DesignSync` `get_file` from the *CampusConnect Student Dashboard* project, 13 screens +
   `CampusConnect UI Kit.dc.html`). The mockup's tokens/structure win; don't redesign.
2. **Applied the `frontend-design` and `next-best-practices` skills** while building (aesthetic
   direction where no mockup exists; RSC boundaries, `Link`, `viewport`/`metadata`, async APIs).
3. **Passed a `web-design-guidelines` review in BOTH themes** — visible `:focus-visible`
   (global base is in `globals.css`), `aria-hidden` on decorative icons, `color-scheme`, skip
   link to `#main`, `translate="no"` on brand/`#REQ` tokens, reduced-motion, content that
   handles long/empty input. Baseline for the built pages landed in `ui-quality-baseline`.

**Testing:**
- If the Chrome extension isn't connected, drive the real app with **headless Playwright**.
- The Identity Toolkit REST endpoint `accounts:signInWithPassword?key=<webApiKey>` tests auth
  credentials directly (fast sanity check without a browser).

**Docs:** these learnings are mirrored to the Obsidian `campus-connect` vault (`Reference/`
notes) for the durable knowledge base.
