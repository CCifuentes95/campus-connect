## Context

US-01/US-02 shipped auth, role-gated routing, and the read-only student dashboard. All
Firestore access so far is **reads** through `FirebaseServerApp` (`lib/data/student-dashboard.ts`)
under the signed-in user, so `firestore.rules` enforce ownership. US-03 introduces the app's
**first write**. The shape we pick here — a server action that validates with zod and writes
through the same per-request `FirebaseServerApp` client — becomes the template every later
mutation (US-04 booking, US-05 reply/reopen, US-07 staff transitions) will follow, so it's
worth getting the conventions right now rather than later.

Sources of truth: `docs/data-model.md` (tickets + events fields, category/status labels,
indexes), `docs/design-brief.md` (the two screens), `firestore.rules` (access control).
Existing reusable pieces: `components/dashboard/request-card.tsx`, `lib/labels.ts`, and the
`getRecentTickets` read pattern.

## Goals / Non-Goals

**Goals:**
- A validated create server action in `lib/actions/tickets.ts` that writes a `tickets` doc +
  a `created` event through `FirebaseServerApp`, establishing the write pattern.
- `/requests/new` (form + "What happens next" sidebar; empty / validation / submitted) and
  `/requests` (list with filter tabs + sort), both matching their mockups in light and dark.
- A paired `firestore.rules` change so the owner can author the `created` event.

**Non-Goals:**
- Track Ticket detail (`/requests/[id]`) — that's US-05. The success "View request" link
  points at `/requests` for now.
- Any staff-side transition, reply, internal note, or the `{ from: [...] }` transition map —
  US-05/US-07. This story only writes the *initial* `status: "new"`.
- Notifications on create (US-06). File attachments (not in the MVP data model).
- Server-side filtering/sorting or composite indexes for the list — done in-memory.

## Decisions

### 1. Write through FirebaseServerApp in a server action (not Admin SDK, not a route handler)

The create action runs `"use server"`, validates with zod, then writes with the **client**
Firestore SDK bound to the per-request `FirebaseServerApp` (same instance the reads use, via
a new `getFirestoreForUser`-style accessor). Rules apply under the student's ID token; the
existing `tickets` create rule (`studentId == uid && status == "new" && assigneeId == null`)
already permits exactly this. The Admin SDK stays out of the Vercel tier (ADR-0004).
*Alternative considered:* an API route handler — rejected per the "server actions over route
handlers for mutations" principle.

### 2. Sequential ticket-then-event writes, best-effort audit (not an atomic batch)

The `events` create rule checks ownership via `get()` on the parent ticket. Inside a
`writeBatch` that also creates the ticket, that `get()` sees pre-batch state (no ticket) and
the event write fails. Firestore rules evaluate each write against **committed** state, not
sibling writes in the same batch — so batching ticket + first event is impossible while the
event rule reads the ticket. We therefore write the ticket first, then the event; the event
is best-effort (wrapped so its failure never fails the submission). *Alternatives:* (a) drop
the `get()` ownership check so a batch passes — rejected: it would let any student write
`created` events onto anyone's ticket path; (b) skip the `created` event entirely — rejected:
the data model specifies it and US-05's timeline needs the origin row.

### 3. Reference code derived from the doc id (no counter)

Pre-generate the ticket ref with `doc(collection(db, "tickets"))` (an id without a write),
set `code = "REQ-" + ref.id.slice(-6).toUpperCase()`, then `setDoc(ref, ...)`. Unique
because the id is unique; no counter doc, no transaction, no extra read.
**Justified deviation:** codes read alphanumeric (`REQ-A3F9K2`) rather than the mockup's
illustrative numeric `REQ-2042`. *Alternative considered:* a Firestore counter doc bumped in
a transaction — rejected as over-engineering for MVP volume.

### 4. List: one query, filter + sort in-memory on the client

A server component fetches `tickets where studentId == uid orderBy updatedAt desc` (limit
generous, e.g. 100) via `FirebaseServerApp` and passes plain serializable rows to a
`"use client"` list component that owns the filter tabs (All / Open / Waiting for you /
Resolved) and the sort select (Recently updated / Priority / Date opened). Volume per student
is tiny, so in-memory beats four filtered queries + the composite indexes they'd need. The
one query reuses the existing `tickets` `studentId + updatedAt` index. Reads return a
`LoadResult<T>` so an undeployed-index error renders distinctly from a genuine empty list
(same convention as US-02).

### 5. RSC boundary — client at the leaves

`app/(student)/requests/new/page.tsx` is a server component (metadata + static sidebar);
only the form (`request-form.tsx`) is `"use client"` and uses `useActionState` against the
server action for the validation/submitted states. `app/(student)/requests/page.tsx` is a
server component that fetches; the filter/sort UI (`requests-list.tsx`) is the client leaf.
Reuse `components/dashboard/request-card.tsx` for the cards.

## Risks / Trade-offs

- **Non-atomic create** → a ticket can exist without its `created` event if the second write
  fails. Mitigation: event is audit-only; US-05 tolerates a missing origin row; log the
  failure server-side.
- **Rules relaxation scope creep** → only add `type == "created"` to the owner branch; keep
  `actorId == uid`, `visibility == "public"`, and `ticketOwner()`. No other event type opens.
- **Undeployed rules** → the events-rule change must be `firebase deploy --only firestore:rules`
  before create works end-to-end in prod (rules deploy is manual, per AGENTS.md). The ticket
  write itself already passes today's rules; only the audit event needs the new rule.
- **Alphanumeric code vs mockup** → cosmetic; recorded as a justified deviation.
- **In-memory list cap** → if a student ever exceeds the fetch limit the list silently
  truncates. Mitigation: set the limit well above realistic MVP volume; revisit with
  pagination if needed (out of scope).

## Migration Plan

1. Add `zod` to `package.json` (web workspace) — currently absent.
2. Land the `firestore.rules` events-rule change; deploy manually
   (`firebase deploy --only firestore:rules`).
3. Ship the routes + action via the normal Vercel Action on merge to `main`.
4. No data migration — new collection writes only; existing seed tickets are unaffected.

Rollback: revert the routes/action; the rules change is additive (permits one more event
type) and safe to leave, but can be reverted independently if needed.

## Open Questions

- None blocking. Track Ticket wiring (`/requests/[id]`) is intentionally deferred to US-05.
