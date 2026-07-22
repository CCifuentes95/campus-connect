## MODIFIED Requirements

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
