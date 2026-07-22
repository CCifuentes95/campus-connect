## Why

US-02 gave the student a dashboard that reads their tickets, but there is no way to
*create* one — every ticket today is seed data. US-03 delivers the first real write in the
app: a student submits a support request and sees it in a filterable list of all their
requests. This is the student spine's first mutation, so it also sets the server-action +
zod + audit-event conventions that US-04/05/07 will copy.

## What Changes

- **New route `/requests/new`** — Submit Support Request form (Title, Category, Priority,
  Description) with a "What happens next" sidebar; empty, validation-error, and submitted
  success states.
- **New route `/requests`** — the student's full request list with filter tabs
  (All / Open / Waiting for you / Resolved) and a sort select (Recently updated / Priority /
  Date opened), reusing the dashboard request card.
- **First server action** (`lib/actions/`) — creates a `tickets` doc through
  `FirebaseServerApp` under the signed-in user (rules apply; **never** the Admin SDK),
  with **zod** validation at the boundary. Establishes the app's write pattern.
- **Sequential ticket + audit-event write** — create the ticket, then its first
  `events` doc (`type: "created"`). Not a batch: the events create rule reads the parent
  ticket via `get()`, which can't see a same-batch create. Audit event is best-effort.
- **firestore.rules change (paired)** — extend the owner branch of the `events` create rule
  to also permit `type == "created"` (still `actorId == uid`, `visibility == "public"`,
  `ticketOwner()`), so the student can author the first audit row.
- **Human-facing reference code** — derived from the ticket doc id
  (`REQ-` + last 6 chars, uppercased); no counter, guaranteed unique.

## Capabilities

### New Capabilities
- `support-requests`: creating a support ticket (validated server action, `status: "new"`,
  denormalized `studentName`, `created` audit event, derived `code`) and listing the
  student's own tickets with client-side filter + sort.

### Modified Capabilities
<!-- No existing capability's requirements change. The events-rule relaxation is an
     implementation detail of the new support-requests create flow, captured in design.md
     and firestore.rules, not a change to an existing spec's behavior. -->

## Impact

- **New code:** `app/(student)/requests/new/` (server page + client form), `app/(student)/requests/`
  (server page + client filter/sort list), `lib/actions/tickets.ts` (create server action +
  zod schema), a `lib/data/` list read (`getStudentTickets`).
- **Reused:** `components/dashboard/request-card.tsx`, `lib/labels.ts`
  (`categoryLabel` / `studentStatusLabel` / `priorityStyle`), the `getRecentTickets` read
  pattern in `lib/data/student-dashboard.ts`, `FirebaseServerApp` (`lib/firebase/server.ts`).
- **Rules:** `firestore.rules` events create rule relaxed for `type == "created"` — must be
  deployed manually (`firebase deploy --only firestore:rules`).
- **Dependencies:** `zod` (add if not already present). Depends on US-02.
- **Deferred:** the success "View request" link targets `/requests` (list) for now; US-05
  rewires it to `/requests/[id]` (Track Ticket).
