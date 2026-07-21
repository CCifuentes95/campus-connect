## ADDED Requirements

### Requirement: IBU account sign-in

The system SHALL authenticate users with their IBU email and password via Firebase Auth.
The sign-in screen SHALL NOT offer any role selection — the account determines the role.
Every authenticated IBU account is at least a `student`; there is no "not authorised" state.
On success the user SHALL be routed to their role's home; on failure the specific error
SHALL be surfaced without leaking whether an account exists beyond the messages defined below.

#### Scenario: Successful sign-in
- **WHEN** a user submits a valid IBU email and correct password
- **THEN** an authenticated session is established and the user is redirected to their
  role's home (student `/`, staff `/staff/triage`, admin `/admin/reports`)

#### Scenario: Wrong password
- **WHEN** a user submits an email that matches an IBU account but an incorrect password
- **THEN** the form shows "Incorrect email or password" and the user remains on `/login`
  unauthenticated

#### Scenario: No account found
- **WHEN** a user submits an email that has no IBU account (e.g. a non-`@ibu.edu` address)
- **THEN** the form shows "No account found" and no session is created

#### Scenario: Account with no explicit role signs in as student
- **WHEN** a user authenticates with a valid IBU account that has no role claim
- **THEN** they are treated as a `student` and routed to the student home `/`

### Requirement: Keep me signed in

The system SHALL let the user choose whether the session persists on the device.

#### Scenario: Persistent session chosen
- **WHEN** the user signs in with "Keep me signed in on this device" checked
- **THEN** the session persists across browser restarts until sign-out or expiry

#### Scenario: Session not persisted
- **WHEN** the user signs in without "Keep me signed in" checked
- **THEN** the session does not persist beyond the browser session

### Requirement: Sign-out

The system SHALL allow an authenticated user to sign out, ending the session.

#### Scenario: User signs out
- **WHEN** an authenticated user signs out
- **THEN** the session is cleared and any subsequent access to a protected route redirects
  to `/login`

### Requirement: SSR session for rule-scoped reads

The system SHALL make the signed-in session available to server components so they read
Firestore through `FirebaseServerApp` under the user's own credentials, so `firestore.rules`
apply to every server-side read. Client code SHALL receive Firebase configuration from
environment variables only, never hard-coded secrets.

#### Scenario: Server component reads as the signed-in user
- **WHEN** a server component renders for an authenticated user and reads Firestore
- **THEN** the read is performed via `FirebaseServerApp` under that user's credentials and
  is subject to `firestore.rules`

#### Scenario: Unauthenticated request to a protected route
- **WHEN** a request without a valid session reaches any route other than `/login`
- **THEN** the user is redirected to `/login`
