## ADDED Requirements

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
zod (required, non-empty after trimming, bounded length) before any write.

#### Scenario: Reply moves a waiting ticket back to assigned

- **WHEN** a student posts a non-empty reply on a ticket whose status is `waiting_for_student`
- **THEN** a `student_reply` public event is appended and the ticket status becomes `assigned`

#### Scenario: Empty reply is rejected

- **WHEN** a student submits the comment box with an empty or whitespace-only message
- **THEN** no event is written, no transition occurs, and an inline validation error is shown

### Requirement: Comment on an in-flight request without changing status

When a ticket's status is `new` or `assigned`, the detail page SHALL offer the same comment
box; submitting SHALL append a `student_reply` public event but SHALL leave the status
unchanged (the ticket remains `new` or `assigned`). The comment box SHALL NOT be offered for
`resolved` or `closed` tickets — those SHALL show the reopen affordance instead.

#### Scenario: Comment on an assigned ticket keeps it assigned

- **WHEN** a student posts a reply on a ticket whose status is `assigned`
- **THEN** a `student_reply` public event is appended and the status remains `assigned`

#### Scenario: Resolved and closed tickets show reopen instead of a comment box

- **WHEN** a student opens a ticket whose status is `resolved` or `closed`
- **THEN** no comment box is shown and a Reopen affordance is offered instead

### Requirement: Reopen a resolved or closed request

When a ticket's status is `resolved` or `closed`, the detail page SHALL offer a Reopen action
that transitions the ticket to `assigned` as a plain field update (status + `updatedAt`),
guarded by a `{ from: [...] }` map, through `FirebaseServerApp` under the student. Reopen SHALL
NOT write an audit event (a deliberate deviation from the tickets "event per transition"
convention — recorded in the change) and MUST NOT change `studentId` or `assigneeId`. After a
successful reopen the page SHALL reflect the `assigned` status.

#### Scenario: Reopening a resolved ticket returns it to assigned

- **WHEN** a student invokes Reopen on a ticket whose status is `resolved`
- **THEN** the ticket status becomes `assigned` with no audit event written, and `studentId`/`assigneeId` are unchanged

#### Scenario: Reopening a closed ticket returns it to assigned

- **WHEN** a student invokes Reopen on a ticket whose status is `closed`
- **THEN** the ticket status becomes `assigned`
