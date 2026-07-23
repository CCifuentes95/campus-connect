## Context

US-01…US-06 built the student spine and its notifications. Staff can already *read* every
ticket and appointment (`firestore.rules` `isStaff()`), but there is no staff UI and no
staff-driven mutations — tickets sit in `new`, unassigned. US-07 adds the staff work surface:
a triage board, a staff ticket-detail workspace, the staff status/assignment transitions, the
advisor appointment surface deferred from US-04 (ADR-0005), and staff→student notifications.

Constraints carried from the codebase (do not relitigate):
- Mutations are `"use server"` actions validated with zod; reads use `FirebaseServerApp` under
  the caller's credentials so rules apply (never the Admin SDK on Vercel — ADR-0004).
- Status is never set directly — every transition is a named action with a `{ from: [...] }`
  guard that appends an `events` audit doc. Tickets have events; appointments do not.
- Reads are single bounded fetches filtered/sorted in memory to avoid composite indexes
  (US-02/US-05/requests pattern).
- `"use server"` exports take only serializable args; shared write helpers taking a live `db`
  live in plain modules (`lib/notify.ts`).

## Goals / Non-Goals

**Goals:**
- Triage board at `/staff/triage` (KPIs, Queue + Kanban, filters/sort) reading all tickets.
- Staff ticket detail at `/staff/requests/[id]`: timeline w/ internal notes, two-mode
  composer, status-actions + triage-field editing.
- Staff transitions: claim, assign/reassign, unassign, request-info, mark-resolved, close —
  each an audited named action.
- Kanban drag-and-drop (dnd-kit) as an accelerator for the input-free transitions, with a
  drop-opens-composer path for request-info.
- Staff→student in-app notifications (relax the notification-create rule for `isStaff()`).
- Advisor appointment schedule + staff Appointment Detail + mark-completed.

**Non-Goals:**
- Email/push delivery of notifications (deferred — no Cloud Functions; see fcm-push-architecture).
- Auto-close scheduled function (US-05 note; still deferred).
- Admin reporting / charts (US-08).
- Feature-flag layer (handled as a separate `feature-flags` change).
- Advisor availability management ("Set availability" is a stub — availability stays the
  static config from US-04).

## Decisions

### 1. New capability module split, mirroring US-05

- **Reads** → `lib/data/staff-tickets.ts` (board list + staff detail) and `lib/data/staff.ts`
  (staff roster for the assignee pickers). Advisor appointment reads extend
  `lib/data/appointments.ts` (a `getAdvisorAppointments` + a staff-scoped detail read).
- **Writes** → `lib/actions/staff-tickets.ts` (all ticket transitions + triage-field edits)
  and `completeAppointment` added to `lib/actions/appointments.ts`.
- **Labels** → staff-facing status/category maps added to `lib/labels.ts`
  (`staffStatusLabel`, `staffCategoryLabel`), leaving the student maps untouched.
- *Alternative considered:* one mega-action file. Rejected — keeps the student ticket actions
  (US-03/05) and staff actions separate, matching the existing per-capability layout.

### 2. Board read = one bounded fetch, filter/sort in memory

Staff read all tickets via `getDocs(query(collection('tickets'), orderBy('updatedAt','desc'),
limit(N)))`. `orderBy` on a single field uses the automatic index — **no composite index to
deploy**. KPIs, the unassigned/assigned grouping, filters (status/priority/owner/category),
sort, and "unassigned only" are all computed in memory from that one set. Same for the staff
roster: `users where role in ['advisor','admin']` (single-field, automatic index; staff may
read all user docs). "Now" for age/staleness is computed once in the RSC and passed to client
children (the `nowMs()` purity pattern) so server/client renders can't drift.

- *Alternative:* per-filter Firestore queries. Rejected — would force composite indexes and a
  deploy step for an MVP-scale dataset; the codebase already standardizes on in-memory.
- *Trade-off:* a very large ticket volume would truncate at `N`; acceptable for the MVP,
  `log`/note the cap (revisit with pagination if it ever matters).

### 3. Named transitions + `{ from: [...] }` maps, one event per transition

Reusing the US-03/US-05 write shape. The staff transition maps:

| Action | from → to | event type | side effects |
|---|---|---|---|
| Claim | `new` → `assigned` | `claimed` | assignee = me; notify student (`ticket_update`) |
| Assign / Reassign | any open | (unchanged) | assignee = chosen; `reassigned` event |
| Unassign | any assigned | (unchanged) | assignee = null; `reassigned` event (note: unassigned) |
| Request info | `assigned` → `waiting_for_student` | `info_requested` (public message) | notify student (`ticket_update`) |
| Reply | `assigned`/`waiting…` → `waiting_for_student` | `message` (public) | notify student (`ticket_reply`) |
| Internal note | (no status change) | `internal_note` (`visibility:internal`) | none |
| Mark resolved | `assigned` → `resolved` | `resolved` | set `resolvedAt`; notify student (`ticket_update`) |
| Close | `resolved` → `closed` | `closed` | none |

The event is written **after** the ticket update (the events create rule `get()`s the parent —
it can't see a same-batch write; the US-03 gotcha). Notification writes are best-effort
(swallow + log) so a notify failure never fails the transition.

### 4. Kanban drag-and-drop reconciled with "named action captures input"

dnd-kit provides the drag; the *drop handler* maps `(from,to)` to a named action. Direct-commit
drops are only the input-free transitions (`new→assigned` = claim-by-me; `assigned→resolved` =
mark resolved). `assigned→waiting_for_student` needs a message, so the drop **opens the
request-info composer** and commits only on submit — cancel reverts the card (optimistic move
rolled back). Any non-permitted drop snaps back with no write. Every transition remains
reachable from the detail panel, so the board is fully operable without dragging (keyboard /
reduced-motion). This is the crux decision that lets us add DnD without breaking the
never-set-status-directly principle.

- *Alternative:* free drag = silent status set. Rejected — bypasses required input (a claim's
  assignee, a request-info's message) and the audit-per-transition invariant.
- *Trade-off:* the drop-opens-composer path is the fiddly bit; it and the snap-back are the
  primary Kanban test targets.

### 5. Staff→student notifications: relax the create rule for `isStaff()`

The US-06 rule was `allow create: if isSelf(uid) && …`. It becomes `if (isSelf(uid) ||
isStaff()) && <same type-enum + shape asserts>`. No new `type` values — staff reuse
`ticket_reply` (reply) and `ticket_update` (claim/request-info/resolve). `notifyStudent(db,
{uid, …})` already takes a target uid, so a staff action calls it with the *ticket's*
`studentId`. This is the only rules change; it is paired with a `docs/data-model.md` note.

- *Alternative:* a Cloud Function fan-out on ticket writes. Rejected — no Functions in the MVP
  (fcm-push-architecture); inline best-effort write is the established pattern.
- *Trade-off:* staff can now write into any student's notifications subcollection. Bounded by
  the type enum + exact-fields assert; acceptable for the MVP threat model (staff are trusted).

### 6. Advisor appointment surface = UI + one action on existing schema

Rules already allow staff appointment read/update. The advisor schedule is a staff-scoped
read (`advisorId == uid`, default) rendered with the person shown as the student. Mark-completed
is a `{ from: ["booked"] }` guarded field update — no event (appointments have no audit
subcollection, per the US-04 convention). "Set availability" stays a stub.

## Risks / Trade-offs

- **Kanban DnD complexity** → Keep drag as a pure accelerator over the always-present
  detail-panel actions; test snap-back, the composer-on-drop, and reduced-motion explicitly.
- **In-memory board cap** → truncates beyond `N` tickets; note the cap, revisit with
  pagination only if real volume demands it.
- **Broadened notification-create rule** → mitigated by keeping the type enum + exact-fields
  assertions; staff are trusted actors in this model.
- **Owner/assignee filter needs names** → assignee denormalized as `assigneeName` on every
  assignment write, so the board never fans out to `users`.
- **Rules must be deployed manually** (`firebase deploy --only firestore`) — the notification
  rule change is inert until deployed; call it out in tasks.

## Migration Plan

1. Land the code + rules change on a feature branch; verify the app (Playwright, both themes).
2. Deploy Firestore rules manually (`firebase deploy --only firestore`) — the staff→student
   notification create is rejected until this lands.
3. Seed staff-side demo data (extra tickets across statuses, an unassigned backlog, advisor
   appointments) so the board, kanban, and schedule have content.
4. No rollback of data needed — additive fields (`nextAction` already in schema) and a rule
   relaxation; reverting the rule re-tightens notification creation.

## Open Questions

- None blocking. Assignee-picker roster is read live from `users`; if that ever needs to be
  richer (titles/avatars) it stays a denormalized read, not a join.
