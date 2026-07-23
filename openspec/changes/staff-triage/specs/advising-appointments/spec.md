## ADDED Requirements

### Requirement: Advisor appointment schedule

A signed-in staff member (advisor or admin) SHALL be able to view advising appointments from a
staff-facing schedule, read through `FirebaseServerApp` under their own credentials (rules
already permit `isStaff()` to read all appointments — no Admin SDK). An advisor's default view
SHALL be **their own** advising schedule (appointments whose `advisorId` equals the signed-in
uid), with the person shown as the **student** ("With <student>") rather than the advisor.
Each appointment SHALL render as a card (date tile, service chip, status badge, title, time,
student, format) linking to the staff Appointment Detail. The view SHALL distinguish an error
state from an empty schedule.

#### Scenario: Advisor sees their own schedule

- **WHEN** an advisor opens their advising schedule
- **THEN** they see appointments assigned to them, each showing the student they are meeting

#### Scenario: Read failure is distinguished from empty

- **WHEN** the schedule read fails
- **THEN** an error state is shown, distinct from the "no appointments" empty state

### Requirement: Staff Appointment Detail

A signed-in staff member SHALL be able to open an appointment at its staff detail route, read
via `FirebaseServerApp`. The view SHALL show the appointment's code, service, status, time,
mode/location, and the **student** party, and — when the appointment is `booked` — expose the
mark-completed action. A non-existent appointment SHALL render a not-found state.

#### Scenario: Staff opens an appointment detail

- **WHEN** a staff member opens an appointment they can read
- **THEN** they see its details with the student party and, if it is `booked`, a
  mark-completed action

#### Scenario: Missing appointment renders not-found

- **WHEN** a staff member opens the staff appointment detail for an id that does not exist
- **THEN** a not-found state is shown

### Requirement: Mark an appointment completed

A staff member SHALL be able to mark a `booked` appointment **completed** through a server
action guarded by a `{ from: ["booked"] }` transition map: it SHALL set `status` to
`completed` and SHALL NOT change `studentId` or `advisorId`. Appointments have no audit
subcollection, so no event is written (consistent with the existing cancel/reschedule
transitions). A mark-completed attempted on an appointment that is not `booked` (already
completed or cancelled) SHALL be rejected with no write.

#### Scenario: Marking a booked appointment completed

- **WHEN** a staff member marks a `booked` appointment completed
- **THEN** its `status` becomes `completed`, `studentId`/`advisorId` are unchanged, and no
  event document is written

#### Scenario: Transition guard rejects a non-booked appointment

- **WHEN** mark-completed is attempted on an appointment that is `cancelled` or already
  `completed`
- **THEN** the transition is rejected and no write occurs
