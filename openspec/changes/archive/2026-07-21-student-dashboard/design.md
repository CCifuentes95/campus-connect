## Context

US-01 shipped auth, role claims, and role-gated routing; the student home
(`app/(student)/page.tsx`) is still a placeholder. This change makes it the real dashboard
and, in doing so, is the **first place the app reads Firestore under the signed-in user via
`FirebaseServerApp`** (ADR-0004). Everything the reads touch — the `tickets` and
`appointments` read rules, the `users/{uid}` self-read, and the two `studentId`-scoped
composite indexes — already exists; this change exercises them for the first time. It is
read-only: no writes, no server actions, no status transitions (those arrive in US-03/US-04).

Constraints: TypeScript strict; brand tokens (`bg-navy`, `text-gold`, …) already defined in
`app/globals.css` but not yet used on the student surface; no Admin SDK on the web tier;
Firestore has no joins, so display names are read from denormalized fields on the docs.

## Goals / Non-Goals

**Goals:**
- Render the two-lane dashboard (populated + per-lane empty states) per `docs/design-brief.md`.
- Stand up a reusable read path: `getFirestoreForUser()` from the request's `FirebaseServerApp`,
  plus small typed query helpers for the student's recent tickets, upcoming appointments, and
  own profile.
- Map stored enums to student-facing labels (status, category) at the render boundary.
- Wire the real profile `displayName`/`initials` into the hero and top nav.
- Introduce shared card components (request card, appointment card) reusable by US-03/US-05
  (requests list) and US-04 (appointments list).

**Non-Goals:**
- Any write, mutation, server action, or status transition.
- The linked destination routes themselves (`/requests`, `/requests/new`, `/requests/[id]`,
  `/appointments*`) — links may point at not-yet-built routes; building them is US-03/04/05.
- Pagination or "view all" list screens (dashboard shows a capped preview only).
- Dark theme, real-time listeners, and notification badges.

## Decisions

**Server component + SSR reads via `FirebaseServerApp`.** The page is an async server
component. It calls `getAuthenticatedAppForUser()` (existing) to get the per-request app, then
`getFirestore(firebaseServerApp)` to query as the user. *Alternative:* client-side fetch with
the web SDK — rejected: it would flash empty, expose query logic, and skip the SSR-under-rules
pattern the architecture mandates.

**Thin data layer in `lib/data/`.** Add `lib/firebase/firestore.ts` exposing
`getFirestoreForUser()` (wraps `getAuthenticatedAppForUser` + `getFirestore`), and
`lib/data/student-dashboard.ts` with `getRecentTickets(uid)`, `getUpcomingAppointments(uid)`,
and `getStudentProfile(uid)`. Each returns plain, serializable view types (Timestamps →
millis/ISO, enums intact) so components stay presentational. *Alternative:* query inline in the
page — rejected: the helpers are reused by later stories and keep the page readable.

**Query shapes** (match existing indexes exactly):
- Tickets: `where('studentId','==',uid).orderBy('updatedAt','desc').limit(3)`.
- Appointments: `where('studentId','==',uid).where('start','>=',now).orderBy('start','asc').limit(N)`.
- Open-count badge: derived from the fetched preview when it fits; if a true count is needed
  it can be a `count()` aggregation on `studentId == uid && status != 'closed'`. For the MVP,
  compute badges from a slightly larger capped fetch rather than a second round trip — decided
  in tasks.

**Label mapping at the boundary.** A small `lib/labels.ts` (or co-located map) converts stored
`status`/`category`/`priority` to the student-facing labels and priority colors from
`docs/data-model.md` / `docs/design-brief.md`. Stored value stays canonical; only the view maps
it. This module is shared with US-03/US-05.

**Profile identity replaces the email stopgap.** The student layout currently passes
`user.email` as the nav display name. US-02 reads `users/{uid}` once (memoize with React
`cache` like `getSessionUser`) and threads `displayName`/`initials` into both the hero and
`TopNav`. Missing profile → fall back to email/generic greeting (spec requirement).

**Brand tokens on new surfaces.** New dashboard + card markup uses `bg-navy`/`text-gold`/… and
retires raw hex on these components. Retrofitting the whole app is a separate cross-cutting
cleanup (roadmap), not part of this change.

## Risks / Trade-offs

- **Missing composite index at runtime** → the two needed indexes are already in
  `firestore.indexes.json`; verify they're deployed, and surface Firestore's index-build error
  clearly in dev rather than swallowing it.
- **Missing/partial profile doc** (profiles are function-created, and the MVP runs no Cloud
  Functions) → the profile read must tolerate a missing doc and fall back, per spec; never hard-fail.
- **Empty-state / error ambiguity** — an empty result and a failed read look alike → treat query
  errors distinctly (log + a small inline "couldn't load" state) so an error never masquerades as
  a legitimately empty lane.
- **`start >= now` cutoff at render time** → "upcoming" is computed from server render time; good
  enough for a summary. Fine for the MVP; no live re-evaluation.
- **Timestamp serialization** across the server/client boundary → convert Firestore `Timestamp`
  to millis in the data layer so client card components receive plain data.

## Migration Plan

Additive and read-only. Rewrite `app/(student)/page.tsx`, add the `lib/firebase/firestore.ts`
+ `lib/data/*` helpers and card components, and update the student layout + `TopNav` to use the
profile name. No rules, index, schema, or dependency changes. Rollback = revert the page to the
placeholder; nothing else depends on the new reads yet. Verify by signing in as a seeded student
(populated) and a fresh student (empty state).

## Open Questions

- **Open-count badge source:** derive from a capped fetch vs. a `count()` aggregation — resolve
  in tasks; default to derive-from-fetch for the MVP.
- **Suggestion chips behavior:** do Lane A's empty-state chips deep-link into
  `/requests/new?category=…` (US-03) or are they static hints for now? Default: link with a
  prefilled category if trivial, else static until US-03 lands.
