## Context

US-03 established the write path: a server action validating with zod and writing through the
per-request `FirebaseServerApp` (rules apply, no Admin SDK), returning a discriminated
`useActionState` result. US-04 is the second write and reuses that path wholesale — the new
work is a multi-step booking wizard, deterministic slot generation, and a conflict check.

The `appointments` collection and its rules already exist (`docs/data-model.md`,
`firestore.rules`): student create (`status:"booked"`), student update that keeps
`studentId`/`advisorId` unchanged (cancel/reschedule), staff read/update; and the
`studentId+start` / `advisorId+start` indexes are deployed. US-02 already reads upcoming
appointments (`getUpcomingAppointments`) and renders `appointment-card.tsx`.

Per **ADR-0005**, US-04 is the **student spine only**; advisor views and mark-completed move
to US-07.

## Goals / Non-Goals

**Goals:**
- Book Advising wizard (`/appointments/new`), student Appointments list (`/appointments`),
  and Appointment Detail (`/appointments/[id]`) with cancel + reschedule — matching the
  mockups in light and dark.
- A `lib/actions/appointments.ts` server action set (book/cancel/reschedule) reusing the US-03
  pattern, and `lib/advising.ts` static config + slot generation.

**Non-Goals:**
- Advisor-facing views, advisor availability management, and **mark-completed** (US-07,
  ADR-0005).
- Real advisor calendars / external calendar sync / video-link provisioning (the `location`
  is seeded copy; "Join" is a static link).
- Notifications on booking (US-06). Any `firestore.rules` change (none needed).

## Decisions

### 1. Reuse the US-03 server-action write path

`lib/actions/appointments.ts` mirrors `lib/actions/tickets.ts`: `"use server"`, zod at the
boundary, write via `getFirestoreForUser()` (client SDK bound to `FirebaseServerApp`),
discriminated `useActionState` result. The existing `appointments` create/update rules already
fit — booking sets `status:"booked"`; cancel/reschedule keep `studentId`/`advisorId`. Code =
`APT-`+last-6 of a pre-generated doc id (same trick as tickets).

### 2. Static advising config + deterministic slots (no availability collection)

`lib/advising.ts` holds the 3 advisors and 4 services (with durations: 45/45/30/30) from the
design, plus fixed working hours (morning + afternoon blocks, weekdays). `generateSlots(advisor,
service, date, existing[])` produces candidate `start`s at the service duration and flags any
that overlap an `existing` appointment as unavailable. Pure and testable; runs on the server
for the picker and again in the action as the source of truth. *Alternative:* an `availability`
collection per advisor — rejected as over-built for a seeded MVP.

### 3. Conflict check is student-side only

The booking action reads the student's own appointments (rules-scoped) and rejects a slot that
overlaps one, returning the clashing appointment's label (design: "you already have Financial
aid with Marcus Lee at 10:00 AM"). No advisor double-booking check — it would require reading
the advisor's full schedule (privacy), and slots are seeded/simplified anyway. The generated
grid also greys out slots overlapping the *student's* existing appointments so the conflict is
visible before submit; the action re-checks as the authority.

### 4. Wizard state on the client; reads on the server

`app/(student)/appointments/new/page.tsx` is a server component (metadata + the student's
existing appointments for conflict-greying, passed down). A `"use client"` `booking-wizard.tsx`
owns step state (service → advisor → date/time → confirm) and the sticky summary, and submits
to `bookAppointment` via `useActionState`. The list and detail pages are server components that
fetch and delegate the interactive bits (filter tabs; cancel/reschedule buttons) to client
leaves — same boundary discipline as US-03 (`/login` stays static).

### 5. Reschedule reuses the slot picker

Reschedule is a booked appointment changing its `start`/`end`. The detail page's Reschedule
action opens the Date & time step (same `generateSlots` for the appointment's advisor+service),
and confirming calls `rescheduleAppointment` (guarded `booked → booked`, updates `start`/`end`).
No new picker component. *Alternative:* cancel-and-rebook — rejected: loses the appointment id
and its reference code.

### 6. `appointments.code` field (additive)

The design shows `#APT-2048`; the data model didn't have a code. We denormalize `code` on
create (additive field — the create rule only asserts `studentId`/`status`, so extra fields are
fine). No rules or index change. Deviation, as with tickets: codes read alphanumeric
(`APT-A3F9K2`) vs the mockup's numeric example.

## Risks / Trade-offs

- **Slot generation drift** → the picker and the action must use the *same* `generateSlots`, or
  a slot could pass the UI but fail the action. Mitigation: one shared pure function; the action
  is the authority and returns a clear error.
- **Time zone** → slots are generated in the app's local tz (single-campus MVP); `start`/`end`
  stored as Firestore timestamps. A multi-tz rollout would need explicit tz handling (out of
  scope).
- **No advisor conflict check** → two students could book the same advisor slot. Accepted for
  the seeded MVP; US-07 can add advisor-side availability.
- **Reschedule/cancel race** → last write wins; the `{ from: [...] }` guard rejects acting on an
  already-cancelled/completed appointment (re-read in the action).

## Migration Plan

1. No dependency or rules change (`zod` already present; `appointments` rules already fit).
2. Ship routes + actions via the normal Vercel Action on merge.
3. No data migration; `code` is written only on new appointments (existing seed appointments
   without a code render a graceful fallback in the UI).

Rollback: revert the routes/actions/config; no schema or rules change to undo.

## Open Questions

- None blocking. Advisor availability + mark-completed intentionally deferred to US-07.
