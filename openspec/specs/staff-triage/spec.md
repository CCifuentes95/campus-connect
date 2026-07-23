# staff-triage Specification

## Purpose
The staff triage capability: how advisors/admins work the incoming request queue. Covers the triage board (KPIs, Queue + Kanban views with dnd-kit drag transitions, filters/sort), assignment (claim/assign/reassign/unassign), the staff ticket-detail workspace (activity timeline incl. internal notes, the two-mode Reply/Internal-note composer), the staff-driven status transitions (request-info, mark-resolved, close) with their `events` audit docs, and the staff-only `nextAction` field. All reads/writes go through `FirebaseServerApp` under the signed-in staff member so `firestore.rules` apply (staff read all tickets, author any event visibility); the Admin SDK is never used. Named transitions live in plain `{ from: [...] }` maps; each writes an audit event and, where relevant, best-effort notifies the owning student.

## Requirements

### Requirement: Triage board access and KPIs

Staff (advisor or admin) SHALL access a triage board at `/staff/triage`; the route SHALL be
staff-gated (a student reaching it is redirected to their role home). The board SHALL read
every ticket through `FirebaseServerApp` under the staff member's own credentials (rules
permit `isStaff()` to read all tickets — no Admin SDK) and SHALL display three KPI tiles:
**Unassigned** (tickets with `assigneeId == null` that are not closed), **Assigned to me**
(open tickets whose `assigneeId` equals the signed-in staff uid), and **Open total** (all
non-closed tickets).

#### Scenario: A student cannot reach the triage board

- **WHEN** a signed-in student navigates to `/staff/triage`
- **THEN** they are redirected to their role home and do not see the board

#### Scenario: KPI tiles reflect the queue

- **WHEN** a staff member opens the board
- **THEN** the Unassigned, Assigned to me, and Open total tiles show counts computed from all
  non-closed tickets, with "Assigned to me" scoped to the signed-in staff member's uid

#### Scenario: Read failure is distinguished from an empty queue

- **WHEN** the tickets read fails
- **THEN** the board shows an error state distinct from the "queue is clear" empty state

### Requirement: Queue and Kanban views

The board SHALL offer a **Queue** view and a **Kanban** view via a toggle, both rendered from
the same fetched ticket set (filtering and sorting happen in memory — no per-view query, no
composite index). The Queue view SHALL present two grouped tables — **Needs triage ·
unassigned** and **In progress · assigned** (rows owned by the signed-in staff member visually
distinguished) — with columns Priority, Request (title + category + code + age), Status, Owner,
Next action, and Actions. The Kanban view SHALL present four columns — New, Assigned, Waiting
for student, Resolved — of compact cards (priority, code, title, category, owner). A card
SHALL open the staff ticket detail on activation (click/Enter), and Queue rows SHALL link to
the same. Staff-facing status and category labels SHALL be used (e.g. `assigned` renders
"Assigned", `registration` renders "Academic").

#### Scenario: Toggling between Queue and Kanban

- **WHEN** a staff member switches the view toggle
- **THEN** the same tickets re-render as grouped tables (Queue) or four status columns (Kanban)
  without a new server fetch

#### Scenario: Unassigned work is grouped separately

- **WHEN** the Queue view renders
- **THEN** unassigned (non-closed) tickets appear in the "Needs triage" group and assigned
  tickets in the "In progress" group

#### Scenario: Cleared queue empty state

- **WHEN** no tickets need triage or are in progress
- **THEN** the board shows the "The queue is clear 🎉" empty state

### Requirement: Kanban drag-and-drop transitions

The Kanban view SHALL support dragging a card between columns (dnd-kit) to drive a status
transition, **without violating the "a named action captures its required input" principle**.
A drop SHALL map to the corresponding named server action only when the (from → to) pair is a
permitted staff transition; any other drop (invalid or non-adjacent target) SHALL snap the
card back with no write. Transitions that need no extra input SHALL commit directly on drop:
**New → Assigned** = Claim (assignee = the acting staff member) and **Assigned → Resolved** =
Mark resolved. A transition that requires input SHALL NOT commit silently: **Assigned →
Waiting for student** = Request info SHALL open the reply/request-info composer on drop and
commit only when the staff member supplies and submits the message; cancelling SHALL revert
the card. The board SHALL be operable without dragging — every Kanban transition SHALL also be
reachable via the ticket detail's status-actions panel (drag is an accelerator, not the only
path), and the drag interaction SHALL respect reduced-motion preferences.

#### Scenario: Dragging a New card to Assigned claims it

- **WHEN** a staff member drags a `new` card into the Assigned column
- **THEN** the Claim action runs (status → `assigned`, assignee = the acting staff member, a
  `claimed` event appended) and the card settles in Assigned

#### Scenario: Dragging into Waiting for student prompts for the message

- **WHEN** a staff member drags an `assigned` card into the Waiting-for-student column
- **THEN** the request-info composer opens; on submit the ticket moves to
  `waiting_for_student` with an `info_requested` event, and on cancel the card reverts to
  Assigned with no write

#### Scenario: An invalid drop snaps back

- **WHEN** a staff member drops a card onto a column that is not a permitted transition from its
  current status
- **THEN** the card returns to its original column and no write occurs

#### Scenario: Kanban transitions are reachable without dragging

- **WHEN** a staff member cannot or does not drag
- **THEN** the same transitions are available from the ticket detail's status-actions panel

### Requirement: Board filters and sort

The board SHALL offer client-side controls — filter selects for Status, Priority, Owner, and
Category; a sort control (Priority, Date submitted newest, Date submitted oldest); and an
"Unassigned only" switch — all applied in memory to the fetched set. Active filters SHALL be
reflected in the visible rows/cards and the result count.

#### Scenario: Filtering narrows the visible tickets

- **WHEN** a staff member selects Priority = High and Status = Assigned
- **THEN** only high-priority assigned tickets are shown and the count reflects the filtered set

#### Scenario: Unassigned-only switch

- **WHEN** the "Unassigned only" switch is on
- **THEN** only tickets with `assigneeId == null` are shown across the current view

### Requirement: Assignment actions

Staff SHALL be able to change a ticket's assignment through named server actions, each writing
via `FirebaseServerApp` under the staff member's credentials and appending an `events` audit
doc: **Claim** (`new → assigned`, sets `assigneeId`/`assigneeName` to the acting staff member),
**Assign to…** and **Reassign…** (set `assigneeId`/`assigneeName` to a chosen staff member),
and **Unassign** (clears `assigneeId`/`assigneeName`). The assignee picker SHALL be populated
from a staff roster read (users whose role is advisor or admin). Every assignment action SHALL
bump `updatedAt` and denormalize `assigneeName` onto the ticket.

#### Scenario: Claiming a new ticket

- **WHEN** a staff member claims an unassigned `new` ticket
- **THEN** its `status` becomes `assigned`, `assigneeId`/`assigneeName` are set to the acting
  staff member, and a `claimed` event is appended

#### Scenario: Reassigning to another staff member

- **WHEN** a staff member reassigns a ticket to a different advisor
- **THEN** `assigneeId`/`assigneeName` update to the chosen advisor and a `reassigned` event is
  appended

#### Scenario: Unassigning returns a ticket toward triage

- **WHEN** a staff member unassigns an assigned ticket
- **THEN** `assigneeId`/`assigneeName` are cleared and the ticket appears in the unassigned group

### Requirement: Staff ticket detail workspace

Staff SHALL work a single ticket at `/staff/requests/[id]`, staff-gated and read via
`FirebaseServerApp`. The page SHALL show a header (code, priority, category, title, student,
submitted time, staff status pill), an activity timeline including staff-only internal notes,
and a properties/status-actions panel. A non-existent ticket SHALL render a not-found state.

#### Scenario: Staff sees the full timeline including internal notes

- **WHEN** a staff member opens a ticket detail
- **THEN** the activity timeline shows student messages, system status events, and internal
  notes (which a student never sees)

#### Scenario: Missing ticket renders not-found

- **WHEN** a staff member opens `/staff/requests/[id]` for an id that does not exist
- **THEN** a not-found state is shown

### Requirement: Reply and internal-note composer

The staff ticket detail SHALL provide a two-mode composer. **Reply to student** SHALL append a
public `message` event and transition the ticket to `waiting_for_student`, and SHALL
best-effort notify the student. **Internal note** SHALL append an `internal_note` event with
`visibility == "internal"` and SHALL NOT change status. Both run through server actions with
zod validation; the message body is required.

#### Scenario: Replying to the student

- **WHEN** a staff member sends a reply to the student
- **THEN** a public `message` event is appended, the ticket moves to `waiting_for_student`, and
  a notification is created in the student's inbox

#### Scenario: Adding an internal note

- **WHEN** a staff member saves an internal note
- **THEN** an `internal_note` event with `visibility == "internal"` is appended, the ticket
  status is unchanged, and no student notification is created

#### Scenario: A student can never read an internal note

- **WHEN** the owning student reads the ticket's events
- **THEN** internal-visibility events are excluded (enforced by `firestore.rules` and the query
  filter)

### Requirement: Staff status transitions

Staff SHALL drive the ticket lifecycle through named server actions guarded by
`{ from: [...] }` maps, each appending an `events` audit doc and bumping `updatedAt`:
**Request info** (`assigned → waiting_for_student`, `info_requested` event), **Mark resolved**
(`assigned → resolved`, sets `resolvedAt`, `resolved` event), and **Close**
(`resolved → closed`, `closed` event). A transition attempted from a status outside its
`from` set SHALL be rejected with no write. Request-info and mark-resolved SHALL best-effort
notify the student; a notification failure MUST NOT fail the transition.

#### Scenario: Marking a ticket resolved

- **WHEN** a staff member marks an `assigned` ticket resolved
- **THEN** its `status` becomes `resolved`, `resolvedAt` is set, a `resolved` event is appended,
  and the student is notified

#### Scenario: Invalid transition is rejected

- **WHEN** a staff member attempts to close a ticket that is still `assigned` (not `resolved`)
- **THEN** the transition is rejected and no write occurs

#### Scenario: Notification failure does not fail the transition

- **WHEN** a status transition write succeeds but the subsequent notification write fails
- **THEN** the transition is still reflected and no error is surfaced to the staff member

### Requirement: Triage field editing

Staff SHALL edit a ticket's **priority**, **category**, and **next action** from the detail
panel through a server action. `nextAction` is a short staff-only note shown on the board and
in the detail panel and SHALL NEVER be shown to the student. These edits SHALL bump
`updatedAt` and SHALL NOT change `status`, `studentId`, or `assigneeId`.

#### Scenario: Editing the next action

- **WHEN** a staff member sets a ticket's next action to "Confirm hold with Records"
- **THEN** the ticket's `nextAction` field updates and the value appears on the board and the
  detail panel

#### Scenario: Next action is never shown to the student

- **WHEN** the owning student views the ticket
- **THEN** the `nextAction` value is not rendered anywhere in the student-facing views
