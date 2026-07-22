## MODIFIED Requirements

### Requirement: Book an advising appointment

A signed-in student SHALL be able to book an advising appointment from `/appointments/new`
through a 4-step wizard (Service → Advisor → Date & time → Confirm). The system SHALL create
the appointment through a server action that writes via `FirebaseServerApp` under the
student's own credentials (rules apply; no Admin SDK). The appointment SHALL be stored with
`status:"booked"`, `studentId` set to the caller's uid, a denormalized `studentName` and
`advisorName`, the chosen canonical `service`, `advisorId`, `start`/`end` timestamps, `mode`,
and `location`. Service and advisor SHALL come from the static advising config; `end` SHALL be
`start` plus the service's duration. After the appointment is created, the action SHALL
best-effort write an `appointment_booked` notification for the student linking to the
appointment; a failure to write the notification MUST NOT be surfaced as a booking failure.

#### Scenario: Valid booking creates an appointment

- **WHEN** a student completes the wizard with a service, advisor, and an available slot and confirms
- **THEN** an `appointments` document is created with `status:"booked"`, the caller's `studentId`, denormalized `studentName`/`advisorName`, the chosen `service`/`advisorId`, `start`/`end` spanning the service duration, and `mode`/`location`
- **AND** the student is shown the confirmed-booking success state with the appointment's reference code
- **AND** an `appointment_booked` notification is created for the student, linking to the appointment

#### Scenario: Unauthenticated booking is rejected

- **WHEN** a booking request arrives with no valid session
- **THEN** no appointment is created and the caller is treated as signed-out

#### Scenario: Notification failure does not fail the booking

- **WHEN** the appointment write succeeds but the subsequent notification write fails
- **THEN** the student still sees the confirmed-booking success state

### Requirement: View, cancel, and reschedule an appointment

A signed-in student SHALL be able to view one of their own appointments at
`/appointments/[id]` and, when it is `booked`, cancel it or reschedule it. Cancel SHALL move
`booked → cancelled`; reschedule SHALL update `start`/`end` to a newly chosen available slot
while keeping `status:"booked"` and the same advisor/service. Both SHALL run through a server
action with a `{ from: [...] }` transition guard and SHALL NOT change `studentId` or
`advisorId`. Appointments have no audit subcollection, so no event is written. Mark-completed
is out of scope (deferred to staff). After a successful cancel, the action SHALL best-effort
write an `appointment_cancelled` notification for the student; after a successful reschedule,
the action SHALL best-effort write an `appointment_booked` notification for the student (the
reschedule is treated as a re-confirmation, not a new notification type — see the change's
design.md for rationale). Both notifications link to the appointment.

#### Scenario: Cancel a booked appointment

- **WHEN** a student cancels their booked appointment
- **THEN** its `status` becomes `cancelled`, the detail view shows the cancelled state with a "Book again" action, and an `appointment_cancelled` notification is created for the student

#### Scenario: Reschedule keeps it booked

- **WHEN** a student reschedules a booked appointment to a new available slot
- **THEN** its `start`/`end` update to the new slot, `status` stays `booked`, `advisorId`/`studentId` are unchanged, and an `appointment_booked` notification is created for the student

#### Scenario: Transition guard rejects an invalid change

- **WHEN** a cancel or reschedule is attempted on an appointment that is not `booked` (already cancelled or completed)
- **THEN** the transition is rejected, no write occurs, and no notification is created

#### Scenario: Notification failure does not fail the transition

- **WHEN** a cancel or reschedule write succeeds but the subsequent notification write fails
- **THEN** the student still sees the updated appointment state
