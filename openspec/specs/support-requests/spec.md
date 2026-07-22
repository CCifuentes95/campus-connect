# support-requests Specification

## Purpose
The student support-request capability: how a signed-in student creates a support ticket, how that ticket is validated, coded, and audited on creation, how the student lists, filters, and sorts their own requests, and how the student views one ticket (stepper + activity timeline), replies to it, and reopens a resolved/closed one. Reads and writes go through `FirebaseServerApp` under the student's own credentials so `firestore.rules` apply; the Admin SDK is never used.

## Requirements
### Requirement: Submit a support request

A signed-in student SHALL be able to create a support ticket from `/requests/new` by
providing a title, category, priority, and description. The system SHALL create the ticket
through a server action that writes via `FirebaseServerApp` under the student's own
credentials (so `firestore.rules` apply); the Admin SDK MUST NOT be used. The new ticket
SHALL be stored with `status: "new"`, `assigneeId: null`, `studentId` set to the caller's
uid, and a denormalized `studentName`. Category and priority SHALL be stored as their
canonical values (`docs/data-model.md`), not display labels.

#### Scenario: Valid submission creates a ticket

- **WHEN** a signed-in student submits the form with a valid title, category, priority, and description
- **THEN** a `tickets` document is created with `status: "new"`, `assigneeId: null`, the caller's `studentId`, denormalized `studentName`, and the chosen canonical category and priority
- **AND** the student is shown the submitted success state with the request's reference code

#### Scenario: Unauthenticated submission is rejected

- **WHEN** a request to create a ticket arrives with no valid session
- **THEN** no ticket is created and the caller is treated as signed-out (no write occurs)

### Requirement: Submit form validation

The server action SHALL validate input with zod at the boundary before any write. Title and
description SHALL be required and non-empty after trimming; description SHALL be at most 1000
characters; category SHALL be one of the canonical category values; priority SHALL be one of
`low` / `medium` / `high` and SHALL default to `medium` when unspecified. On validation
failure the system SHALL NOT write any document and SHALL return field-level errors that the
form renders as a top alert plus inline messages under the offending fields.

#### Scenario: Missing required fields are rejected

- **WHEN** a student submits with an empty title, no category, or an empty description
- **THEN** no ticket is created
- **AND** the form shows a top "please complete the required fields" alert and an inline error under each offending field

#### Scenario: Over-long description is rejected

- **WHEN** a student submits a description longer than 1000 characters
- **THEN** no ticket is created and an inline length error is shown under the description field

#### Scenario: Priority defaults to medium

- **WHEN** a student submits a valid form without changing the priority control
- **THEN** the created ticket has priority `medium`

### Requirement: Human-facing reference code

Each created ticket SHALL carry a `code` field derived from its own Firestore document id
(`REQ-` followed by the last 6 characters of the id, uppercased). The code SHALL be unique
and SHALL be shown to the student on the success state and on every request card.

#### Scenario: Code is derived from the document id

- **WHEN** a ticket is created
- **THEN** its `code` equals `"REQ-"` concatenated with the uppercased last 6 characters of its document id

### Requirement: Creation writes an audit event

After the ticket is created the system SHALL append a `created` event to the ticket's
`events` subcollection with `visibility: "public"`, `actorId` equal to the student's uid,
the denormalized `actorName`, and `actorRole: "student"`. The audit write is best-effort:
if it fails, the ticket still exists and the failure MUST NOT be surfaced as a submission
failure. `firestore.rules` SHALL permit the owning student to create an event of
`type == "created"` (in addition to `student_reply`), subject to the same `actorId == uid`,
`visibility == "public"`, and `ticketOwner()` constraints.

#### Scenario: First event records the creation

- **WHEN** a ticket is successfully created
- **THEN** a `created` event is written to its `events` subcollection with `visibility: "public"`, `actorId` = the student's uid, and `actorRole: "student"`

#### Scenario: Audit failure does not fail the submission

- **WHEN** the ticket write succeeds but the subsequent event write fails
- **THEN** the student still sees the submitted success state for the created ticket

### Requirement: List the student's requests

A signed-in student SHALL be able to view all of their own support requests at `/requests`.
The list SHALL be read with a single query scoped to `studentId == uid` ordered by
`updatedAt` descending, through `FirebaseServerApp`. Each request SHALL render as a card
showing the priority-tinted header, student-facing status label, title, category chip,
reference code, and last-updated time, linking to that request. A student SHALL NOT see any
other student's requests.

#### Scenario: Student sees their own requests

- **WHEN** a signed-in student opens `/requests`
- **THEN** they see a card for each of their own tickets, most-recently-updated first, and none belonging to other students

#### Scenario: Read failure is distinguished from empty

- **WHEN** the list query fails (e.g. an undeployed index)
- **THEN** the page shows an error state distinct from the "no requests" empty state

### Requirement: Filter and sort the request list

The request list SHALL offer filter tabs — All, Open, Waiting for you, Resolved — each
showing a count, and a sort select — Recently updated, Priority, Date opened. Filtering and
sorting SHALL be applied in-memory over the single fetched result set on the client. Per the
mockup: "Open" SHALL include in-flight tickets only (`new`, `assigned`, `waiting_for_student`)
and SHALL exclude done tickets; "Waiting for you" SHALL include only `waiting_for_student`;
"Resolved" SHALL include done tickets (`resolved` and `closed`). (This "Open" is the list
filter's in-flight sense — distinct from the dashboard "N open" badge, which counts every
non-closed ticket.)

#### Scenario: Filtering by a tab narrows the list

- **WHEN** a student selects the "Waiting for you" tab
- **THEN** only tickets with status `waiting_for_student` are shown, and the tab count matches

#### Scenario: Sorting reorders the list

- **WHEN** a student chooses "Priority" from the sort select
- **THEN** the visible cards reorder by priority (high first) without a new server request

#### Scenario: A filter with no matches shows a per-filter empty state

- **WHEN** a student selects a filter that matches none of their tickets
- **THEN** an in-view empty message ("No requests in this view — try another filter") is shown rather than the whole-page empty state



### Requirement: View one support request

A signed-in student SHALL be able to open one of their own tickets at `/requests/[id]`. The
page SHALL read the single `tickets/{id}` document and its `events` subcollection through
`FirebaseServerApp` under the student's own credentials (so `firestore.rules` apply; the Admin
SDK MUST NOT be used). It SHALL render the ticket header (category, priority, reference `code`,
title, student-facing status), a status stepper, the activity timeline, and a details sidebar
(status, category, priority, created time, created-by, assigned advisor or "Not yet assigned",
and last-updated time). A student SHALL NOT be able to view another student's ticket.

#### Scenario: Student opens their own ticket

- **WHEN** a signed-in student navigates to `/requests/[id]` for a ticket they own
- **THEN** the page shows the ticket's header, stepper, activity timeline, and details sidebar for that ticket

#### Scenario: A non-owner or missing ticket is not found

- **WHEN** a student requests `/requests/[id]` for a ticket they do not own, or for an id that does not exist
- **THEN** the read returns nothing (rules deny a non-owner read) and the page renders a not-found state rather than another student's data

#### Scenario: Read failure is distinguished from not found

- **WHEN** the ticket read fails for a reason other than absence/permission (e.g. an undeployed index or transport error)
- **THEN** the page shows an error state distinct from the not-found state

### Requirement: Status stepper reflects the ticket's progress

The detail page SHALL render a five-step stepper — New → Assigned → Waiting for you →
Resolved → Closed — that reflects the ticket's current status. Steps before the current status
SHALL render as complete, the current status SHALL be marked current, and later steps SHALL
render as not-yet-reached. The stepper SHALL derive its position from the stored status only;
it MUST NOT fabricate a status the ticket does not hold (e.g. no closed-on-read for an old
resolved ticket — auto-close remains a deferred Cloud Function).

#### Scenario: Stepper marks the current status

- **WHEN** a ticket's status is `waiting_for_student`
- **THEN** New and Assigned render as complete, Waiting for you renders as current, and Resolved and Closed render as not-yet-reached

#### Scenario: An aged resolved ticket is not shown as closed

- **WHEN** a ticket has status `resolved` set more than three days ago
- **THEN** the stepper and status pill still show Resolved (the stored status), not Closed

### Requirement: Activity timeline of public events

The detail page SHALL render the ticket's `events` subcollection as a chronological timeline
ordered by `createdAt` ascending. Only events with `visibility == "public"` SHALL be shown to
the student (internal staff notes MUST NOT reach the client; `firestore.rules` already denies
them). Each entry SHALL show the actor's denormalized name, an actor role indication, and a
deterministic time. `student_reply` and `created` events with a message SHALL render the message
as a comment; status-transition events SHALL render a "status changed to …" indication;
system-authored events SHALL be visually distinguished from person-authored ones.

#### Scenario: Timeline shows public events oldest-first

- **WHEN** a student opens a ticket that has several public events
- **THEN** the events are listed oldest-first with each actor's name, role, and time

#### Scenario: Internal notes are never shown to the student

- **WHEN** a ticket has an event with `visibility` other than `public`
- **THEN** that event does not appear in the student's timeline

### Requirement: Reply to a request awaiting the student

When a ticket's status is `waiting_for_student`, the detail page SHALL offer a comment box
whose submission writes a `student_reply` event (`visibility: "public"`, `actorId` = the
student's uid, denormalized `actorName`, `actorRole: "student"`, the entered message) and, in
the same action, transitions the ticket `waiting_for_student → assigned`. The transition SHALL
be guarded by a `{ from: [...] }` map in the server action; a reply requested from any other
status SHALL NOT perform the waiting→assigned transition. The message SHALL be validated with
zod (required, non-empty after trimming, bounded length) before any write. After the event and
transition succeed, the action SHALL best-effort write a `ticket_reply` notification
(`users/{studentId}/notifications`) linking to the ticket; a failure to write the notification
MUST NOT be surfaced as a reply failure.

#### Scenario: Reply moves a waiting ticket back to assigned

- **WHEN** a student posts a non-empty reply on a ticket whose status is `waiting_for_student`
- **THEN** a `student_reply` public event is appended and the ticket status becomes `assigned`
- **AND** a `ticket_reply` notification is created for the student, linking to the ticket

#### Scenario: Empty reply is rejected

- **WHEN** a student submits the comment box with an empty or whitespace-only message
- **THEN** no event is written, no transition occurs, no notification is created, and an
  inline validation error is shown

#### Scenario: Notification failure does not fail the reply

- **WHEN** the reply event and status transition succeed but the subsequent notification
  write fails
- **THEN** the student still sees the reply posted successfully

### Requirement: Comment on an in-flight request without changing status

When a ticket's status is `new` or `assigned`, the detail page SHALL offer the same comment
box; submitting SHALL append a `student_reply` public event but SHALL leave the status
unchanged (the ticket remains `new` or `assigned`). The comment box SHALL NOT be offered for
`resolved` or `closed` tickets — those SHALL show the reopen affordance instead. After the
event write succeeds, the action SHALL best-effort write a `ticket_reply` notification for the
student, the same as the waiting-for-student reply path.

#### Scenario: Comment on an assigned ticket keeps it assigned

- **WHEN** a student posts a reply on a ticket whose status is `assigned`
- **THEN** a `student_reply` public event is appended, the status remains `assigned`, and a
  `ticket_reply` notification is created for the student

#### Scenario: Resolved and closed tickets show reopen instead of a comment box

- **WHEN** a student opens a ticket whose status is `resolved` or `closed`
- **THEN** no comment box is shown and a Reopen affordance is offered instead

### Requirement: Reopen a resolved or closed request

When a ticket's status is `resolved` or `closed`, the detail page SHALL offer a Reopen action
that transitions the ticket to `assigned` as a plain field update (status + `updatedAt`),
guarded by a `{ from: [...] }` map, through `FirebaseServerApp` under the student. Reopen SHALL
NOT write an audit event (a deliberate deviation from the tickets "event per transition"
convention — recorded in the change) and MUST NOT change `studentId` or `assigneeId`. After a
successful reopen the page SHALL reflect the `assigned` status. After the transition succeeds,
the action SHALL best-effort write a `ticket_update` notification for the student linking to
the ticket.

#### Scenario: Reopening a resolved ticket returns it to assigned

- **WHEN** a student invokes Reopen on a ticket whose status is `resolved`
- **THEN** the ticket status becomes `assigned` with no audit event written, `studentId`/
  `assigneeId` are unchanged, and a `ticket_update` notification is created for the student

#### Scenario: Reopening a closed ticket returns it to assigned

- **WHEN** a student invokes Reopen on a ticket whose status is `closed`
- **THEN** the ticket status becomes `assigned` and a `ticket_update` notification is created
  for the student
