# notifications Specification

## Purpose
The student notifications capability: how in-app notifications are written (best-effort, from inside the same server actions that mutate tickets/appointments — no Cloud Functions in this MVP), how a signed-in student reads their inbox and marks notifications read, how per-type/per-channel preferences are saved, and how the shared nav shows an unread indicator. Reads and writes go through `FirebaseServerApp` under the student's own credentials so `firestore.rules` apply; the Admin SDK is never used. Email/Push channels are collected as preferences but not yet delivered; `appointment_reminder` is deferred (no scheduled function).

## Requirements
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

### Requirement: View notification inbox

A signed-in student SHALL be able to view their own notifications at `/notifications`
(Inbox tab), read via `FirebaseServerApp` scoped to their own uid, ordered `createdAt`
descending. The Inbox SHALL offer an Unread / All read view toggle and group results into
Today / Earlier sections. Each row SHALL show a type-tinted tile (ticket = teal, appointment
= navy), the title (bold when unread), body, a relative timestamp, and an unread dot; each
row SHALL link to its `link`. When there are no notifications for the selected view, the
Inbox SHALL show an empty state ("You're all caught up" for the all-read/empty case).

#### Scenario: Student sees only their own notifications, newest first

- **WHEN** a signed-in student opens the Inbox
- **THEN** they see their own notifications ordered most-recent-first, grouped into Today and
  Earlier, and none belonging to another user

#### Scenario: Unread view shows only unread notifications

- **WHEN** a student selects the Unread toggle
- **THEN** only notifications with `read == false` are shown

#### Scenario: Empty inbox shows the caught-up state

- **WHEN** a student has no notifications matching the selected view
- **THEN** the "You're all caught up" empty state is shown instead of an empty list

#### Scenario: Read failure is distinguished from empty

- **WHEN** the notifications query fails (e.g. an undeployed composite index)
- **THEN** the page shows an error state distinct from the "all caught up" empty state

### Requirement: Mark notifications as read

A signed-in student SHALL be able to mark a single notification as read from the Inbox, and
mark all of their notifications as read with one action. Both SHALL run through a server
action, under the student's own credentials, that updates only the `read` field —
`firestore.rules` SHALL reject any update to a notification that changes a field other than
`read`.

#### Scenario: Marking one notification read

- **WHEN** a student marks an unread notification as read
- **THEN** that notification's `read` field becomes `true` and its unread dot disappears

#### Scenario: Mark all as read

- **WHEN** a student uses "Mark all as read"
- **THEN** every one of their notifications has `read == true`

#### Scenario: A field other than `read` cannot be changed by the owner

- **WHEN** an update attempt to a notification changes any field besides `read`
- **THEN** the write is rejected by `firestore.rules`

### Requirement: Notification preferences

A signed-in student SHALL be able to view and save notification channel preferences at
`/notifications` (Preferences tab): a matrix of rows — Ticket updates, Appointment
reminders, Advisor messages, Announcements — by columns — Email, Push, In-app — persisted to
`users.notificationPrefs` on the student's own profile document via a server action. The
Preferences tab SHALL show an inline note that Email and Push delivery are not yet
implemented (values are saved but no message is sent on those channels), and SHALL offer a
"Mute all non-essential" control and a "Save preferences" action.

#### Scenario: Saving preferences persists the full matrix

- **WHEN** a student toggles several cells in the channel matrix and saves
- **THEN** `users.notificationPrefs` on their profile reflects every toggle's state

#### Scenario: Mute all non-essential clears non-essential toggles

- **WHEN** a student uses "Mute all non-essential"
- **THEN** the non-essential rows' toggles are cleared while essential ticket-update delivery
  remains on

### Requirement: Notification bell indicator

The shared top navigation SHALL show a notification bell for a signed-in student, with a
gold dot when the student has at least one unread notification. Staff and admin navigation
SHALL NOT show the bell in this change (no staff-driven notification events exist yet).

#### Scenario: Bell shows a dot when unread notifications exist

- **WHEN** a student with at least one unread notification loads any student page
- **THEN** the nav bell renders with a gold unread indicator

#### Scenario: Bell shows no dot when everything is read

- **WHEN** a student with zero unread notifications loads any student page
- **THEN** the nav bell renders without the unread indicator

#### Scenario: Staff and admin do not see the bell

- **WHEN** a signed-in advisor or admin loads any page
- **THEN** the top navigation does not render a notification bell
