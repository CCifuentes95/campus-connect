## Why

US-02 shows the student their upcoming appointments, but there is no way to *book* one —
every appointment today is seed data. US-04 delivers the booking flow (a 4-step wizard), the
student's Appointments list, and the Appointment Detail view with cancel + reschedule. It's
the app's second write, so it reuses the server-action + zod pattern US-03 established and
adds the multi-step-wizard + slot-generation patterns.

## What Changes

- **New route `/appointments/new`** — Book Advising, a 4-step wizard (Service → Advisor →
  Date & time → Confirm) with a sticky "Your appointment" summary, seeded slot availability,
  a student-side booking-conflict alert, and a confirmed-success state.
- **New route `/appointments`** — the student's Appointments list with filter tabs
  (Upcoming / Past / All), grouped cards reusing the dashboard appointment card, status
  badges (Booked / Completed / Cancelled), and per-view empty states.
- **New route `/appointments/[id]`** — Appointment Detail (single-column card): status badge,
  service, advisor, detail rows (date/time, format, reference), optional note, and
  status-appropriate actions (booked → Reschedule / Cancel / Join; cancelled → Book again).
- **Second server action** (`lib/actions/appointments.ts`) — `bookAppointment` (create,
  `status:"booked"`, denormalized `advisorName`/`studentName`, derived `APT-` code, **zod**
  validation, student-side conflict check), plus `cancelAppointment` and
  `rescheduleAppointment` (a `{ from: [...] }` guard; update `start`/`end`). Through
  `FirebaseServerApp` under the user — no Admin SDK.
- **Static advisor + service config** (`lib/advising.ts`) — 3 advisors, 4 services with
  durations, and deterministic slot generation from fixed working hours; a slot is marked
  unavailable when it overlaps an existing appointment. No `availability` collection.
- **`appointments.code`** — a human reference (`APT-`+last-6 of the doc id) denormalized on
  create, to satisfy the design's `#APT-2048`. (Additive field; no rules change.)

**Scope:** student spine only. The **advisor Appointments variant, advisor Detail view, and
mark-completed are deferred to US-07** (see `docs/adr/0005-appointments-student-spine-first.md`).

## Capabilities

### New Capabilities
- `advising-appointments`: booking an advising appointment (validated wizard, seeded slots,
  student-side conflict check, `status:"booked"`, denormalized names, derived `code`), listing
  the student's appointments with filters, and viewing/cancelling/rescheduling one.

### Modified Capabilities
<!-- No existing capability's requirements change. Appointment reads already power the US-02
     dashboard, but student-dashboard's spec is unchanged; this adds a new capability. -->

## Impact

- **New code:** `app/(student)/appointments/new/` (server page + client wizard),
  `app/(student)/appointments/` (server page + client filtered list),
  `app/(student)/appointments/[id]/` (server page + client actions),
  `lib/actions/appointments.ts` (book/cancel/reschedule + zod), `lib/advising.ts` (advisor +
  service config + slot generation), `lib/data/appointments.ts` (list + detail reads).
- **Reused:** `components/dashboard/appointment-card.tsx`, `lib/labels.ts` (`serviceLabel`),
  `lib/format.ts` (`dateTile`/`clockTime`), the `getUpcomingAppointments` read pattern, the
  US-03 `useActionState` server-action approach, `FirebaseServerApp`.
- **Rules:** none — the `appointments` rules already permit student create + cancel/reschedule
  (studentId/advisorId unchanged) + staff read/update. Indexes (`studentId+start`,
  `advisorId+start`) already deployed.
- **Data model:** adds `appointments.code` (additive); no other schema change.
- **Dependencies:** `zod` (already added). Depends on US-02; reuses US-03 patterns.
- **Deferred (US-07):** advisor list/detail views + `mark-completed` (ADR-0005).
