## Why

Students currently have no in-app record of confirmations or activity on their tickets and
appointments beyond what the ticket/appointment detail page shows in the moment — nothing
persists a "you booked X" / "you replied to Y" trail, and there's no way to control which
kinds of activity a student wants to hear about. US-06 closes the student spine's last gap
(auth → dashboard → submit request → track ticket → book advising → **notifications**) with
an in-app inbox and per-type channel preferences.

## What Changes

- Add an in-app notification feed: `users/{uid}/notifications/{notificationId}`, written by
  the same student-authored server actions that already mutate tickets/appointments —
  `replyToTicket`, `reopenTicket`, `bookAppointment`, `cancelAppointment`,
  `rescheduleAppointment`. No Cloud Function fan-out (none are deployed in this MVP).
- Add `/notifications` with two tabs: **Inbox** (unread/all-read view toggle, grouped
  Today/Earlier, mark all as read, per-row mark-read) and **Preferences** (channel matrix:
  Ticket updates / Appointment reminders / Advisor messages / Announcements ×
  Email / Push / In-app, persisted to `users.notificationPrefs`).
- Add an unread-count bell to the shared top nav (student role only in this change).
- **BREAKING (rules)**: relax `firestore.rules` `users/{uid}/notifications` create rule from
  `if false` (function-only) to allow the owning user's signed-in server action to create
  their own notification docs, with field validation (see design.md). This is a security-rule
  loosening, called out explicitly since AGENTS.md flags any data-model change must pair with
  a rules change.
- Out of scope: `appointment_reminder` (needs a scheduled Cloud Function, not deployed in
  this MVP — deferred like ticket auto-close, ADR-0002); FCM push send and email send (the
  Preferences UI collects the opt-in, but no delivery mechanism exists yet — same deferral
  pattern as reminders); staff/admin notifications (no staff-driven ticket events exist until
  US-07 triage ships).

## Capabilities

### New Capabilities
- `notifications`: in-app notification inbox (list, mark read/unread, mark-all-read) and
  per-type/per-channel notification preferences, plus the write-path contract for when a
  notification is created as a side effect of a ticket/appointment action.

### Modified Capabilities
- `support-requests`: `replyToTicket` and `reopenTicket` additionally create a notification
  document for the acting student. No change to ticket status-transition requirements
  themselves — this is an additive side effect.
- `advising-appointments`: `bookAppointment`, `cancelAppointment`, and `rescheduleAppointment`
  additionally create a notification document for the acting student. No change to the
  appointment status-transition requirements themselves.

## Impact

- `firestore.rules` — `users/{uid}/notifications` create rule relaxed + validated (security
  surface change, see design.md for the exact predicate).
- `docs/data-model.md` — no field changes, but the "writes come from functions" framing for
  the notifications subcollection needs a correction to "server-action-written" (a doc
  clarification, not a schema change).
- `lib/actions/tickets.ts`, `lib/actions/appointments.ts` — each gains a best-effort
  notification write after its existing transition write.
- `lib/actions/notifications.ts` (new) — shared notification-create helper, mark-read,
  mark-all-read, and preferences-save server actions.
- `app/(student)/notifications/page.tsx` + supporting components (new) — Inbox/Preferences UI.
- `components/nav/top-nav.tsx` — bell affordance + unread count for the student role.
- `docs/roadmap.md` — mark US-06 in progress/done per the existing entry.
