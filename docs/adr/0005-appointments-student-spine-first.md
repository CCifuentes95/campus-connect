# ADR-0005: Scope US-04 to the student booking spine; defer advisor appointment views to US-07

Status: Accepted

## Context

US-04 (`book-advising`) as sketched in `docs/roadmap.md` bundles a large surface: the student
booking flow (4-step wizard), the student Appointments list + Appointment Detail, **and** the
advisor-facing variants (an advisor's own schedule view) plus the full transition set
(cancel, reschedule, mark-completed). Building all of it in one change would mix the student
self-service spine with staff workflow — and the staff side has no home yet (the staff shell,
gating, and "my work" screens arrive in US-07 `staff-triage`).

The build order is deliberately **student spine first** (US-01→US-05 are all student-facing).
Advisor-owned views belong with the rest of the staff workspace, not bolted onto the student
booking story. The `appointments` `firestore.rules` already permit staff to read all
appointments and update freely, so deferring the advisor UI costs no data-model rework.

## Decision

- **US-04 delivers the student spine only:**
  - Book Advising (`/appointments/new`) — 4-step wizard (Service → Advisor → Date/time →
    Confirm), deterministic seeded slots, student-side conflict check.
  - Student Appointments list (`/appointments`) and Appointment Detail (`/appointments/[id]`).
  - Student transitions: **cancel** (`booked → cancelled`) and **reschedule** (update
    `start`/`end`, status stays `booked`), via a server action with a `{ from: [...] }` guard.
    No `events` audit docs — appointments have no audit subcollection (only tickets do).
- **Deferred to US-07 (`staff-triage`) — the advisor/staff appointment surface:**
  - The **advisor schedule variant** of the Appointments list (an advisor viewing their own
    booked slots) and the advisor view of Appointment Detail.
  - **Mark-completed** (`booked → completed`) — a staff action.
  - Any advisor-side availability management beyond the seeded/simplified slots.

## Consequences

- US-04 stays a cohesive, shippable student vertical slice, consistent with the build order.
- No rules or data-model change is needed to defer: the `appointments` rules already cover
  staff read/update, so US-07 layers UI on top without touching the schema.
- The advisor schedule view is listed twice in planning (roadmap US-04 notes → now US-07);
  the roadmap is updated so US-07 owns it and US-04's scope is explicit.
- `mark-completed` not existing in US-04 means a booked appointment can only be cancelled or
  rescheduled by the student until US-07 ships; acceptable for the MVP demo.

## Alternatives considered

- **Build the whole appointments surface in US-04** — one change covering student + advisor.
  Rejected: it front-loads staff workflow before the staff shell exists (US-07) and breaks the
  student-spine-first order; larger, harder-to-review change.
- **A separate US-04b advisor-appointments change** — a dedicated change just for the advisor
  views. Rejected as redundant: the advisor appointment views are naturally part of the staff
  workspace and share its shell/gating, so folding them into US-07 is simpler.
