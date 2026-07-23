## Why

Students can submit and track requests (US-03/US-05) and book advising (US-04), but staff
have no way to work that queue — every ticket sits in `new`, unassigned, forever. US-07
delivers the staff side of the loop: a triage board to prioritise and assign incoming
requests, a staff ticket-detail workspace to reply/note and drive the status lifecycle, and
the advisor appointment surface deferred from US-04 (ADR-0005). This closes the request
lifecycle end-to-end and is the prerequisite for US-08 admin reporting.

## What Changes

- **Triage board** (`/staff/triage`, staff-gated): 3 KPI tiles (Unassigned, Assigned to me,
  Open total), a **Queue (grouped tables)** view and a **Kanban (4-column)** view toggle,
  client-side filters (Status, Priority, Owner, Category), sort, and an "Unassigned only"
  switch. Row/card actions: **Claim**, **Assign to…**, **Reassign…**, **Unassign**.
- **Staff ticket detail** (`/staff/requests/[id]`): activity timeline including staff-only
  **internal notes**; a two-mode composer (**Reply to student** → `waiting_for_student`;
  **Internal note** → no status change); and a status-actions panel whose buttons depend on
  status — **Claim & triage**, **Request info**, **Mark resolved**, **Close**, plus
  **Assignee** (reassign/unassign), **Priority**, **Category**, and **Next action** editing.
- **Staff ticket transitions** as named server actions guarded by `{ from: [...] }` maps,
  each writing an `events` audit doc (`claimed`, `info_requested`, `internal_note`,
  `resolved`, `closed`, `reassigned`) and denormalizing `assigneeId`/`assigneeName`,
  `nextAction`, `priority`, `category`, `resolvedAt`.
- **Staff → student in-app notifications**: staff reply / request-info / resolve drop a
  notification into the student's inbox (reusing the existing `ticket_reply` / `ticket_update`
  types). **BREAKING (rules):** the notification-create rule relaxes from owner-only
  (`isSelf(uid)`) to also allow `isStaff()` to write into any student's `notifications`
  subcollection; the `type` enum is unchanged.
- **Advisor appointment surface** (deferred from US-04): the advisor "My advising schedule"
  list variant, advisor Appointment Detail, and **mark-completed** (`booked → completed`).
  Rules already permit staff appointment read/update — UI + one action on the existing schema.
- **Staff data reads**: bounded single-fetch of all tickets (staff read every ticket) and a
  staff roster (users where role ∈ {advisor, admin}) for the assignee pickers, filtered/
  sorted in memory (automatic single-field indexes only — no composite indexes to deploy).

## Capabilities

### New Capabilities
- `staff-triage`: the staff triage board (queue + kanban, KPIs, filters), assignment
  (claim/assign/reassign/unassign), the staff ticket-detail workspace, internal notes, the
  `nextAction` field, and the staff-driven ticket status transitions with their audit events.

### Modified Capabilities
- `notifications`: the create rule widens so staff actions notify the owning student's inbox
  (previously owner-self-authored only); the type enum is unchanged.
- `advising-appointments`: add the advisor-facing appointment list/detail views and the
  `mark-completed` (`booked → completed`) staff transition.

## Impact

- **Routes/UI:** `app/(staff)/staff/triage/page.tsx` (replace stub), new
  `app/(staff)/staff/requests/[id]/page.tsx`, advisor appointment views under `(staff)`;
  new `components/staff/*`.
- **Actions:** new `lib/actions/staff-tickets.ts` (claim/assign/reassign/unassign, request
  info, mark resolved, close, internal note, update triage fields) and a
  `completeAppointment` action; `lib/notify.ts` type widening.
- **Data reads:** `lib/data/staff-tickets.ts` (board + staff detail), `lib/data/staff.ts`
  (roster); advisor appointment reads extend `lib/data/appointments.ts`.
- **Labels:** staff-facing status/category labels added to `lib/labels.ts`.
- **Rules:** `firestore.rules` notification-create branch relaxed for staff (paired
  data-model note). No new composite indexes.
- **Depends on:** US-03 (tickets), US-04 (appointments), US-01 staff gating (already built).
