# ADR-0003: All-Firebase stack over a Postgres/SQL backend

Status: Accepted — **hosting amended by ADR-0004** (the Next.js web app is hosted on Vercel,
not Firebase App Hosting; the backend remains all-Firebase).

## Context

CampusConnect needs auth, a database, server-rendered pages, push notifications, scheduled
jobs, and hosting. A conventional choice would be Next.js on Node with Postgres (via an ORM)
plus a separate auth provider, a queue, and a push service. This is an academic-exercise MVP
built by a small team on a deadline, where operational simplicity matters more than raw
query power.

## Decision

Build entirely on the **Firebase suite** — one platform, one console:

- **Firebase Auth** for identity, with **custom claims** for roles.
- **Firestore** as the database (no SQL/Postgres).
- **Firebase App Hosting** for the Next.js App Router app (SSR). *(Superseded by ADR-0004:
  the web app is now hosted on Vercel; the rest of this decision stands.)*
- **Cloud Functions** for privileged/back-end logic (onUserCreate, setRole, notifications,
  auto-close scheduler).
- **FCM** for push notifications.

Server components read Firestore through **`FirebaseServerApp`** so security rules apply
under the signed-in user's credentials; mutations go through **server actions** validated
with zod.

## Consequences

- One vendor, one auth model, one local emulator suite — less integration glue, faster setup.
- **No joins and no `GROUP BY`.** We compensate by denormalizing display names onto
  documents (see docs/data-model.md) and by precomputing/seeding reporting KPIs for the MVP.
- Access control lives in `firestore.rules` (declarative, claim-driven) rather than in
  application middleware.
- Vendor lock-in to Google Cloud; acceptable for an academic MVP. A future move off Firebase
  would require reworking auth, rules, and data access.

## Alternatives considered

- **Next.js + Postgres + ORM + separate auth/push** — stronger relational queries and
  reporting, but far more moving parts to stand up and operate for an MVP. Rejected on
  complexity.
- **Hybrid (Firestore + a SQL reporting store)** — solves KPIs but reintroduces a second
  datastore and sync. Deferred; seed/precompute KPIs instead until reporting demands more.
