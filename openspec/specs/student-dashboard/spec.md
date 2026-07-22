# student-dashboard Specification

## Purpose
The signed-in student's home: a two-lane summary of their recent support requests and upcoming advising appointments, populated from rule-scoped server reads (US-02).

## Requirements
### Requirement: Student dashboard is the student home route

The signed-in student's home route (`/` within the student area) SHALL render the
CampusConnect Dashboard: a greeting hero above a two-lane grid of **Support requests**
(Lane A, wider) and **Advising appointments** (Lane B). The route SHALL be a server
component that reads data during render; it MUST replace the US-01 placeholder.

#### Scenario: Signed-in student opens home

- **WHEN** a user with the `student` role loads the student home route
- **THEN** the dashboard renders with a greeting hero, a Support requests lane, and an
  Advising appointments lane

#### Scenario: Non-student is routed away

- **WHEN** a signed-in user whose role is `advisor` or `admin` requests the student home route
- **THEN** they are redirected to their own role's home (the existing student-layout guard),
  and the dashboard does not render for them

#### Scenario: Signed-out visitor

- **WHEN** a request for the student home route carries no valid session
- **THEN** the visitor is redirected to `/login` and no dashboard data is read

### Requirement: Reads are rule-scoped through FirebaseServerApp

All dashboard data SHALL be read from Firestore through a `FirebaseServerApp` initialized
with the signed-in user's ID token, so `firestore.rules` enforce access under the user's own
credentials. The dashboard MUST NOT use the Admin SDK and MUST NOT bypass rules. The
dashboard is **read-only** — it MUST NOT perform any write, status transition, or server
action.

#### Scenario: Reads execute as the signed-in user

- **WHEN** the dashboard queries tickets, appointments, or the profile
- **THEN** the queries run through the per-request `FirebaseServerApp` seeded with the user's
  token, such that only documents the rules permit for that user are returned

#### Scenario: No cross-student leakage

- **WHEN** the dashboard queries the `tickets` and `appointments` collections
- **THEN** it constrains each query to `studentId == <the signed-in uid>`, and no other
  student's tickets or appointments are read or rendered

### Requirement: Support requests lane shows the student's recent tickets

Lane A SHALL show the signed-in student's most recent tickets, ordered by `updatedAt`
descending and capped to a small number (up to 3), using the composite index
`tickets` (`studentId ==` + `updatedAt desc`). Each request card SHALL show the priority
(with priority-tinted styling), the **student-facing** status label, the title, the category
chip, the `#REQ-<code>` reference, and a relative "Updated <time>". The lane header SHALL
show a count badge of the student's open requests and a "New request" call to action; a
"View all requests" link SHALL point to the requests list route.

#### Scenario: Student has tickets

- **WHEN** the signed-in student has one or more tickets
- **THEN** up to 3 of their most recently updated tickets render as cards, each showing
  priority, status, title, category, `#REQ-<code>`, and "Updated <time>"

#### Scenario: Status label maps to the student audience

- **WHEN** a ticket's stored status is `assigned`
- **THEN** its card shows the student-facing label "In progress" (not the staff label
  "Assigned"); `waiting_for_student` shows "Waiting for you"

#### Scenario: Open count badge

- **WHEN** the lane header renders
- **THEN** the count badge reflects the number of the student's open (not `closed`) requests

### Requirement: Advising appointments lane shows upcoming appointments

Lane B SHALL show the signed-in student's upcoming appointments — those with `start` at or
after now — ordered by `start` ascending and capped to a small number, using the composite
index `appointments` (`studentId ==` + `start asc`). Each appointment card SHALL show a date
tile (month/day/weekday), the service chip, the title, the time, and the advisor name. The
lane header SHALL show a count badge of upcoming appointments and a "Book advising" call to
action.

#### Scenario: Student has upcoming appointments

- **WHEN** the signed-in student has appointments with `start` in the future
- **THEN** those upcoming appointments render as cards ordered soonest-first, each showing the
  date tile, service, title, time, and advisor

#### Scenario: Past appointments are excluded

- **WHEN** the student has an appointment whose `start` is in the past
- **THEN** it does not appear in the upcoming lane

### Requirement: Per-lane empty states for new students

Each lane SHALL render a distinct empty state when the student has no matching data. Lane A's
empty state SHALL read "No requests yet" and offer suggestion chips (e.g. Registration &
holds, Transcripts & records, Advising & planning). Lane B's empty state SHALL read "No
appointments booked". Empty lanes MUST still show their header and primary call to action, and
count badges SHALL read zero.

#### Scenario: Brand-new student

- **WHEN** a student with no tickets and no appointments opens the dashboard
- **THEN** Lane A shows "No requests yet" with suggestion chips, Lane B shows "No appointments
  booked", both lanes keep their CTAs, and both count badges read 0

#### Scenario: One lane empty, one populated

- **WHEN** a student has appointments but no tickets
- **THEN** Lane A shows its empty state while Lane B renders appointment cards

### Requirement: Dashboard uses the student's real profile identity

The dashboard SHALL read the signed-in student's `users/{uid}` profile and use its
`displayName` (and `initials`) for the greeting hero and the top-nav identity, replacing the
US-01 stopgap that displayed the email. If the profile document is missing or lacks a
`displayName`, the UI SHALL fall back gracefully (e.g. to the email or a generic greeting)
rather than error.

#### Scenario: Profile has a display name

- **WHEN** the student's profile has `displayName` "Amara Okafor"
- **THEN** the hero greets "Amara" and the top nav shows "Amara Okafor" with initials "AO"

#### Scenario: Profile missing or incomplete

- **WHEN** the student's profile document does not exist or has no `displayName`
- **THEN** the dashboard still renders, falling back to the email or a generic greeting
  without throwing
