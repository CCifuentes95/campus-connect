## ADDED Requirements

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
