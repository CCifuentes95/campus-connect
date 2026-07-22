# CampusConnect — Roadmap / Backlog

Whole-scope view of the user stories. This is the **stable, lightweight** layer — goal,
screens, data, and dependencies per story. The **detailed** proposal/design/specs/tasks for
each are written just-in-time as an OpenSpec change (`/opsx:propose`) right before building
it, so they reflect what earlier stories taught us. Sources of truth stay
`docs/design-brief.md`, `docs/data-model.md`, and `firestore.rules`.

Build order (student spine first). Suggested OpenSpec change name in `code`.

---

## US-01 — Auth + role-based access ✅ done & archived
IBU sign-in, default-student, advisor/admin via `setRole`, role-gated routing.
Archived at `openspec/changes/archive/2026-07-21-auth-role-access`.

## US-02 — Student dashboard · `student-dashboard` ✅ built
Two-lane dashboard (requests + appointments) with per-lane empty states, rule-scoped
`FirebaseServerApp` reads, and the real profile name wired into the hero + nav. Delivers the
"first rule-scoped server read" (US-01 task 6.2). Change: `openspec/changes/student-dashboard`.
- **Goal:** the signed-in student's home — two lanes side by side (support requests +
  advising appointments), with a new-student empty state.
- **Screens:** CampusConnect Dashboard (populated + empty).
- **Data & rules:** first real server reads — `tickets` where `studentId == me` (recent) and
  `appointments` where `studentId == me` (upcoming), via `FirebaseServerApp` under the user.
  Read-only; no writes.
- **Depends on:** US-01. **Closes** US-01 task 6.2 (first rule-scoped server read).
- **Notes:** replaces the placeholder `app/(student)/page.tsx`. Good moment to roll the brand
  tokens out to the nav + shared card components.

## US-03 — Submit support request · `submit-support-request`
- **Goal:** create a ticket; list all of the student's tickets.
- **Screens:** Submit Support Request (empty / validation / submitted), Requests (list + filters).
- **Data & rules:** server action + **zod** at the boundary → create `tickets` (`status:"new"`,
  category, priority, `studentName` denorm) + a `created` event. Read list `tickets` by
  `studentId` + `updatedAt`.
- **Depends on:** US-02.
- **Notes:** categories/priorities/status labels per `data-model.md`. Reference code `#REQ-…`.

## US-05 — Track ticket status · `track-ticket`
- **Goal:** student views one ticket — stepper, activity timeline, reply, reopen.
- **Screens:** Track Ticket.
- **Data & rules:** read one `tickets/{id}` + its `events` (**public only** — internal notes
  hidden). Student reply = `student_reply` event + `waiting_for_student → assigned`. Reopen =
  `resolved → assigned`. Transitions live in a `{ from: [...] }` map in a server action.
- **Depends on:** US-03.
- **Notes:** auto-close after 3 days (ADR-0002) is a scheduled function — **deferred** in the
  MVP (no Functions); note it or apply on read.

## US-04 — Book advising appointment · `book-advising`
**Scope: student spine only** (advisor views + mark-completed deferred to US-07 — see ADR-0005).
- **Goal:** 4-step booking (service → advisor → date/time → confirm); student list + detail.
- **Screens:** Book Advising (`/appointments/new`), Appointments — **student** (`/appointments`),
  Appointment Detail (`/appointments/[id]`). *(Advisor Appointments variant → US-07.)*
- **Data & rules:** create `appointments` (`status:"booked"`, service, advisorId/Name denorm,
  start/end, mode, location). Conflict check vs the **student's own** appointments only.
  Student transitions: **cancel** (`booked→cancelled`) + **reschedule** (update start/end),
  via a server action `{ from: [...] }` guard. **No `events`** (appointments have no audit
  subcollection). No rules change — the `appointments` rules already permit student
  create/cancel/reschedule + staff read/update.
- **Depends on:** US-02. Reuses the US-03 server-action + zod write pattern.
- **Notes:** advisor availability is **seeded/simplified** — static advisor+service config
  (3 advisors, 4 services) + deterministic slot generation, a slot marked unavailable when it
  overlaps an existing appointment. No `availability` collection.

## US-06 — Notifications + preferences · `notifications`
- **Goal:** in-app inbox + per-type channel preferences.
- **Screens:** Notifications (Inbox + Preferences).
- **Data & rules:** `users/{uid}/notifications` (read/mark-read), `users.notificationPrefs`.
- **Depends on:** US-03 / US-04 (events worth notifying about).
- **⚠ Decisions:** design shows Email/**SMS**/In-app; stack is Email/**Push (FCM)**/In-app.
  Without Functions, FCM fan-out + email delivery aren't live — MVP writes **in-app**
  notifications from the same server actions that mutate tickets/appointments; push/email are
  future work. Confirm the channel set before building.

## US-07 — Advisor/staff triage board · `staff-triage`
- **Goal:** staff work queue + ticket handling.
- **Screens:** Triage Board (queue + kanban), Staff Ticket Detail.
- **Data & rules:** read all `tickets` (staff); actions — Claim (`new→assigned`), Request info
  (`assigned→waiting_for_student`), Mark resolved (`assigned→resolved`), Close, Reassign,
  Unassign — each writes an event. **Internal notes** (`internal_note`, visibility `internal`).
  `nextAction` field shown on the board.
- **Also owns the advisor appointment surface** (deferred from US-04 per ADR-0005): the
  **advisor Appointments variant** (an advisor viewing their own booked slots), the advisor
  view of Appointment Detail, and **mark-completed** (`booked→completed`). `appointments`
  rules already permit staff read/update, so this is UI on top of the existing schema.
- **Depends on:** US-03 (tickets exist), US-04 (appointments exist). Staff gating built in US-01.
- **Notes:** reply-vs-internal-note composer; a staff reply moves to `waiting_for_student`.

## US-08 — Admin reporting · `admin-reporting`
- **Goal:** program-wide KPIs, charts, needs-attention list, role management.
- **Screens:** Admin Dashboard (+ a Users screen for role management).
- **Data & rules:** KPIs (open requests, avg time-to-resolve, appointments booked, satisfaction
  1–5), status donut, category bars, oldest-open table. **Precompute/seed** KPIs for the MVP
  (Firestore has no GROUP BY). Role management = the `setRole` mechanism.
- **Depends on:** US-07.
- **Notes:** admin-only gating already built in US-01.

---

## Cross-cutting (fold in as we go)
- **UI definition-of-done:** every screen must match its `claude-design` mockup, apply the
  `frontend-design` + `next-best-practices` skills, and pass a `web-design-guidelines` review in
  both themes before it's done (see `ui-quality-baseline` + AGENTS.md).
- **Design tokens:** roll `bg-navy`/`text-gold`/… (added in US-01) out to the nav + shared
  components; retire raw hex.
- **Dark theme:** design-brief ships full light+dark; the app is light-only so far.
- **Display names:** the nav shows the email; wire the real `users` profile `displayName` when
  a story first reads the profile (US-02).
- **No Cloud Functions in the MVP:** default-student is in-app; role mgmt via the `setRole`
  script; scheduled auto-close and FCM/email are deferred until Functions are deployed.
