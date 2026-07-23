## MODIFIED Requirements

### Requirement: Notification document shape

A notification SHALL be stored at `users/{uid}/notifications/{notificationId}` with `type`
one of `ticket_update` / `ticket_reply` / `appointment_booked` / `appointment_reminder` /
`appointment_cancelled`, `title`, `body`, `link` (an in-app route), `refId` (the related
ticket or appointment id), `read` defaulting to `false`, and `createdAt` a server timestamp.
`firestore.rules` SHALL allow a notification create only with a `type` in the closed enum
above, only with `read == false`, and only when the document has exactly the required fields.
A notification create SHALL be permitted when **either** the writer is the owner of the
subcollection (`isSelf(uid)`) **or** the writer is staff (`isStaff()`) — the latter so a
staff action on a ticket can drop a notification into the owning student's inbox (no Cloud
Functions in this MVP; the write happens inline in the same staff server action). No new type
values are introduced: staff-driven ticket notifications reuse `ticket_reply` (staff reply)
and `ticket_update` (claim / request-info / resolve).

#### Scenario: A non-staff user cannot create a notification for another user

- **WHEN** a signed-in student attempts to write a document to another user's `notifications`
  subcollection
- **THEN** the write is rejected by `firestore.rules`

#### Scenario: Staff may create a notification in a student's inbox

- **WHEN** a staff member's ticket action writes a notification into the owning student's
  `notifications` subcollection with an in-enum `type` and the required fields
- **THEN** the write is permitted by `firestore.rules`

#### Scenario: An out-of-enum type is rejected

- **WHEN** a create attempt sets `type` to a value outside the closed enum
- **THEN** the write is rejected by `firestore.rules`
