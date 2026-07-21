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
- **Deploy:** one GitHub Actions workflow (`.github/workflows/deploy.yml`) ships the web app
  to Vercel (Vercel CLI) and `functions` + `firestore` rules/indexes to Firebase. Firebase web
  config is injected at build time from GitHub Secrets. One Firebase project for the MVP.

## Architecture principles

- **Server actions over route handlers** for mutations. Validate input with **zod** at the boundary.
- In server components, read Firestore through **`FirebaseServerApp`** so security rules
  apply under the signed-in user's credentials.
- **Roles come from custom claims**, not a Firestore lookup, so rules stay read-free. A
  Cloud Function sets the default `student` claim on signup; an admin-only callable
  promotes users. Claims refresh on the next token refresh — force with `getIdToken(true)`.
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
