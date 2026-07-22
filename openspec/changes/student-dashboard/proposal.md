## Why

With auth and role-routing done (US-01), a signed-in student lands on a placeholder page.
US-02 turns that page into the real student home — a single glance at both support tracks
(requests + advising) — and, in doing so, establishes the app's first **rule-scoped server
reads**: Firestore queries executed through `FirebaseServerApp` under the student's own
credentials, so `firestore.rules` enforce access for real rather than being assumed.

## What Changes

- Replace the placeholder `app/(student)/page.tsx` with the **CampusConnect Dashboard**: a
  greeting hero over a two-lane grid — **Lane A · Support requests** (wider) and
  **Lane B · Advising appointments** — per `docs/design-brief.md`.
- Add the first **read data-access layer**: server-side queries for the signed-in student's
  recent `tickets` (`studentId == me`, `updatedAt desc`, capped) and upcoming `appointments`
  (`studentId == me`, `start >= now`, `start asc`, capped), run via `FirebaseServerApp`.
- Read the student's **`users/{uid}` profile** for the real `displayName`/`initials`, and
  wire it through the top nav (replacing the email-as-name stopgap) and the hero greeting.
- Render **request cards** (priority-tinted header, audience-mapped status pill, category
  chip, `#REQ-code`, "Updated <time>") and **appointment cards** (navy date tile, service
  chip, time, advisor) with links to the (not-yet-built) detail/list routes.
- Handle the **new-student empty state** per lane: Lane A "No requests yet" + suggestion
  chips; Lane B "No appointments booked"; count badges show "N open" / "N upcoming".
- Roll the existing **brand tokens** (`bg-navy`, `text-gold`, …) out to the new dashboard
  and shared card components, retiring raw hex on these surfaces.
- **Read-only:** no writes, no server actions, no status transitions in this change.

## Capabilities

### New Capabilities
- `student-dashboard`: the signed-in student's home screen — a two-lane summary of their
  recent support requests and upcoming advising appointments, with per-lane empty states,
  populated from rule-scoped server reads of `tickets` and `appointments` and the user's
  own profile.

### Modified Capabilities
<!-- No spec-level requirement changes to authentication or role-access; US-02 reads under
     the access model those specs already define. -->

## Impact

- **Code:** `app/(student)/page.tsx` (rewritten as a server component); new read helpers in
  `lib/firebase/` (Firestore-from-`FirebaseServerApp`) and `lib/data/` (student ticket +
  appointment + profile queries); new dashboard/card components under `components/`;
  `app/(student)/layout.tsx` + `components/nav/top-nav.tsx` updated to use the real profile
  name.
- **Data / rules:** first live use of the existing `tickets` and `appointments` **read**
  rules and the `users/{uid}` self-read — no rule changes required. Relies on the already
  declared composite indexes (`tickets` studentId+updatedAt, `appointments` studentId+start).
- **Dependencies:** none new — Firebase client SDK already present. Firestore is queried
  through `FirebaseServerApp`; Admin SDK stays out of the web tier (ADR-0004).
- **Downstream:** unblocks US-03 (submit request) and US-04 (book advising), which add the
  writes and the routes the dashboard cards and CTAs link to.
