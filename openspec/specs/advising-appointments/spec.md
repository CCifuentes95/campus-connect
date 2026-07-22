# advising-appointments Specification

## Purpose
The student advising-appointment capability: how a signed-in student books an advising appointment through a wizard, how that booking is validated, coded, and checked for conflicts, how slot availability is derived from a static advisor + service config, and how the student lists, views, cancels, and reschedules their own appointments. Reads and writes go through `FirebaseServerApp` under the student's own credentials so `firestore.rules` apply; the Admin SDK is never used.

## Requirements
### Requirement: Book an advising appointment

A signed-in student SHALL be able to book an advising appointment from `/appointments/new`
through a 4-step wizard (Service → Advisor → Date & time → Confirm). The system SHALL create
the appointment through a server action that writes via `FirebaseServerApp` under the
student's own credentials (rules apply; no Admin SDK). The appointment SHALL be stored with
`status:"booked"`, `studentId` set to the caller's uid, a denormalized `studentName` and
`advisorName`, the chosen canonical `service`, `advisorId`, `start`/`end` timestamps, `mode`,
and `location`. Service and advisor SHALL come from the static advising config; `end` SHALL be
`start` plus the service's duration.

#### Scenario: Valid booking creates an appointment

- **WHEN** a student completes the wizard with a service, advisor, and an available slot and confirms
- **THEN** an `appointments` document is created with `status:"booked"`, the caller's `studentId`, denormalized `studentName`/`advisorName`, the chosen `service`/`advisorId`, `start`/`end` spanning the service duration, and `mode`/`location`
- **AND** the student is shown the confirmed-booking success state with the appointment's reference code

#### Scenario: Unauthenticated booking is rejected

- **WHEN** a booking request arrives with no valid session
- **THEN** no appointment is created and the caller is treated as signed-out

### Requirement: Booking input validation

The booking server action SHALL validate input with zod at the boundary before any write:
`service` SHALL be one of the configured services, `advisorId` one of the configured advisors,
and `start` a valid future slot that the advisor's working hours produce for the chosen
service duration. On validation failure the system SHALL NOT write and SHALL return an error
the wizard can surface.

#### Scenario: A past or non-grid slot is rejected

- **WHEN** a booking is submitted with a `start` in the past or one that is not a generated slot for that advisor/service/date
- **THEN** no appointment is created and an error is returned

### Requirement: Human-facing reference code

Each booked appointment SHALL carry a `code` field derived from its own Firestore document id
(`APT-` followed by the uppercased last 6 characters of the id). The code SHALL be unique and
SHALL be shown on the success state and the Appointment Detail view.

#### Scenario: Code is derived from the document id

- **WHEN** an appointment is created
- **THEN** its `code` equals `"APT-"` concatenated with the uppercased last 6 characters of its document id

### Requirement: Seeded slot availability

Slot availability SHALL be generated deterministically from a static advisor + service config
(no `availability` collection). For a chosen advisor, service, and date, the system SHALL
produce candidate slots from the advisor's fixed working hours (morning and afternoon blocks)
at the service's duration. A candidate slot SHALL be marked unavailable when it overlaps an
existing appointment. Dates outside working days SHALL offer no slots.

#### Scenario: Slots reflect the service duration

- **WHEN** a student selects a 45-minute service versus a 30-minute service for the same advisor and date
- **THEN** the generated slot grid uses the corresponding duration

#### Scenario: An overlapping slot is shown unavailable

- **WHEN** a candidate slot overlaps an appointment that already exists
- **THEN** that slot is rendered as unavailable and cannot be selected

### Requirement: Student-side conflict check

The booking server action SHALL check the chosen slot against the student's own existing
appointments (a rules-scoped read) and SHALL block a booking that overlaps one. The system
SHALL NOT perform an advisor double-booking check. On conflict the system SHALL NOT write and
SHALL return a message naming the clashing appointment.

#### Scenario: Overlap with the student's own appointment is blocked

- **WHEN** a student confirms a slot that overlaps another of their booked appointments
- **THEN** no appointment is created and an inline alert names the clashing appointment ("you already have …")

### Requirement: List the student's appointments

A signed-in student SHALL be able to view their own appointments at `/appointments`, read via
`FirebaseServerApp` scoped to `studentId == uid`. The list SHALL offer filter tabs —
Upcoming / Past / All — with counts, rendering each appointment as a card (date tile, service
chip, status badge, title, time, advisor, format) linking to its detail. A student SHALL NOT
see another student's appointments.

#### Scenario: Upcoming vs past split

- **WHEN** a student opens `/appointments` and selects Upcoming
- **THEN** only appointments whose `start` is in the future are shown; Past shows only those whose `start` has elapsed

#### Scenario: Read failure is distinguished from empty

- **WHEN** the list read fails
- **THEN** the page shows an error state distinct from the per-view empty state

### Requirement: View, cancel, and reschedule an appointment

A signed-in student SHALL be able to view one of their own appointments at
`/appointments/[id]` and, when it is `booked`, cancel it or reschedule it. Cancel SHALL move
`booked → cancelled`; reschedule SHALL update `start`/`end` to a newly chosen available slot
while keeping `status:"booked"` and the same advisor/service. Both SHALL run through a server
action with a `{ from: [...] }` transition guard and SHALL NOT change `studentId` or
`advisorId`. Appointments have no audit subcollection, so no event is written. Mark-completed
is out of scope (deferred to staff).

#### Scenario: Cancel a booked appointment

- **WHEN** a student cancels their booked appointment
- **THEN** its `status` becomes `cancelled` and the detail view shows the cancelled state with a "Book again" action

#### Scenario: Reschedule keeps it booked

- **WHEN** a student reschedules a booked appointment to a new available slot
- **THEN** its `start`/`end` update to the new slot, `status` stays `booked`, and `advisorId`/`studentId` are unchanged

#### Scenario: Transition guard rejects an invalid change

- **WHEN** a cancel or reschedule is attempted on an appointment that is not `booked` (already cancelled or completed)
- **THEN** the transition is rejected and no write occurs
