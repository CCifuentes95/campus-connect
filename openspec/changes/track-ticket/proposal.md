## Why

US-03 lets a student submit a request and US-03's list (`/requests`) shows all of them, but a
student can't yet **open one ticket** to see where it stands or respond. US-05 delivers the
Track Ticket detail view — a status stepper, the activity timeline, and the two student write
actions the lifecycle needs: **reply** (`waiting_for_student → assigned`) and **reopen**
(`resolved`/`closed → assigned`). It completes the student side of the ticket lifecycle and is
the last piece of the student spine before staff triage (US-07) lights up the other actors.

## What Changes

- **New route `/requests/[id]`** — Track Ticket detail (server component): back link, ticket
  header (category chip, priority glyph, `#REQ` code, title, status pill), a **5-step stepper**
  (New → Assigned → Waiting for you → Resolved → Closed) reflecting the current status, a
  conditional **action banner** (gold "reply now" when waiting / green "resolved, reopen?" when
  resolved or closed), a two-column body: **Activity timeline** (public events — comment bubbles
  vs. status-change chips, person vs. system rows) + an **add-comment box**, and a **Details
  sidebar** (status, category, priority, created, created-by, assigned advisor, last updated).
- **Detail read** (`lib/data/ticket-detail.ts`) — read one `tickets/{id}` (404/forbidden → not
  found) plus its `events` subcollection ordered `createdAt` asc, through `FirebaseServerApp`
  under the student. Students see **public events only** (rules already enforce this); internal
  staff notes never reach the client.
- **Reply + reopen server actions** (added to `lib/actions/tickets.ts`) — `replyToTicket`
  writes a `student_reply` event and, guarded by a `{ from: [...] }` map, transitions
  `waiting_for_student → assigned` (in `new`/`assigned` the comment posts as an event and leaves
  status unchanged); `reopenTicket` flips `resolved`/`closed → assigned` as a plain field update.
  Both **zod**-validated, through `FirebaseServerApp` — no Admin SDK.
- **Request cards become links** — `components/requests/requests-list.tsx` cards link to
  `/requests/[id]` (mirrors what US-04 did for appointment cards; the route didn't exist before).

**Scope: student spine only.** The comment box is shown for the in-flight statuses
(`new` / `assigned` / `waiting_for_student`); `resolved` / `closed` show the **Reopen**
affordance instead. Staff actions (claim, assign, request-info, resolve, close, internal notes)
and the advisor/system-authored timeline events are **US-07** — the timeline renders whatever
public events exist, so it fills in once staff act.

## Capabilities

### New Capabilities
<!-- None. Track Ticket extends the existing student support-request capability. -->

### Modified Capabilities
- `support-requests`: adds the student-facing ticket lifecycle beyond create+list — **view one
  ticket** (single ticket + its public events, stepper, timeline, details), **reply** to a
  waiting ticket (`student_reply` event + `waiting_for_student → assigned`), and **reopen** a
  done ticket (`resolved`/`closed → assigned`, plain field update). Also: request-list cards
  link to the detail route.

## Impact

- **New code:** `app/(student)/requests/[id]/page.tsx` (server detail page),
  `components/requests/ticket-*` (stepper, timeline, comment box, reopen — client leaves for the
  write actions), `lib/data/ticket-detail.ts` (single-ticket + events read).
- **Modified code:** `lib/actions/tickets.ts` (+`replyToTicket`, `reopenTicket`),
  `components/requests/requests-list.tsx` (cards link to `/requests/[id]`),
  possibly `lib/labels.ts` (a `studentStatusStyle` helper for the pill/stepper glyphs, mirroring
  `appointmentStatusStyle`).
- **Reused:** `studentStatusLabel` / `priorityStyle` / `categoryLabel` (`lib/labels.ts`), the
  deterministic date formatting (`lib/format.ts`), the US-03 `useActionState` + zod
  server-action shape, the `{ from: [...] }` transition-guard convention, `FirebaseServerApp`.
- **Rules:** **none** — a first. Every read/write this story needs is already permitted by
  `firestore.rules`: own-ticket read, public-only event reads, `student_reply` event create, and
  student updates resolving to `assigned`/`waiting_for_student` (both reply and reopen land on
  `assigned`). No new field, so no data-model change either.
- **Deviations from the mockup (recorded):** the "This request was reopened" banner is **dropped**
  — reopen writes no event (per decision), so reopened-assigned can't be distinguished from
  staff-assigned; the **Attach file** button is dropped (no Firebase Storage in the MVP); the
  mockup's top **status switcher** is a demo-only control and is omitted; **auto-close** (resolved
  → closed after 3 days) stays a deferred Cloud Function — the page renders the real stored status,
  never a closed-on-read; the **active stepper step is gold in both themes** (the mockup's navy
  active-dot is invisible against the navy card in dark mode — done stays teal, todo outlined).
- **Depends on:** US-03 (tickets + events + list). Reuses US-03/US-04 patterns.
