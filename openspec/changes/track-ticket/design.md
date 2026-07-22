## Context

US-03 established the ticket write path — a `"use server"` action validating with zod and
writing through the per-request `FirebaseServerApp` (rules apply, never the Admin SDK on the web
tier), returning a discriminated `useActionState` result — and the `tickets` + `events` model.
US-05 is the student's read-and-respond view of one ticket. The heavy lifting is already done in
`firestore.rules`, which was written ahead of this story:

- students read their own `tickets/{id}`; a non-owner read is denied (→ our not-found state);
- students read `events` where `visibility == "public"` only (internal notes are staff-only);
- students may create events of type `created` / `student_reply` (public, `actorId == uid`);
- students may update their own ticket as long as the result status is `assigned` or
  `waiting_for_student` and `studentId`/`assigneeId` are unchanged.

Both student write actions in this story — **reply** (`waiting_for_student → assigned`) and
**reopen** (`resolved`/`closed → assigned`) — land on `assigned`, so **no rules change and no
data-model change are needed**. This is the first story with none. Advisors/admins do not exist
until US-07, so the "assigned"/"resolved" system events and advisor replies the mockup shows
won't appear yet — the timeline simply renders whatever public events exist.

## Goals / Non-Goals

**Goals:**
- `/requests/[id]` Track Ticket detail (server component): header, 5-step stepper, conditional
  action banner, activity timeline of public events, add-comment box, details sidebar — matching
  the mockup in light and dark.
- `replyToTicket` and `reopenTicket` server actions added to `lib/actions/tickets.ts`, reusing
  the US-03 pattern and the `{ from: [...] }` transition-guard convention.
- Request-list cards link to the new detail route (fulfilling the existing list requirement).

**Non-Goals:**
- All staff actions — claim/assign/request-info/resolve/close, internal notes, the staff ticket
  detail view — are **US-07**. This story renders staff/system events read-only if present.
- File attachments (no Firebase Storage in the MVP).
- Auto-close (resolved → closed after 3 days): a deferred scheduled Cloud Function; the page
  shows the real stored status, never a closed-on-read.
- Notifications on reply/reopen (US-06). Any `firestore.rules` or data-model change (none needed).

## Decisions

### 1. Detail read: one ticket + its public events, not-found ≠ error

`lib/data/ticket-detail.ts` exposes `getTicketDetail(id)` (wrapped in React `cache`): a
`getDoc(tickets/{id})` plus a `getDocs` of the events, through `getFirestoreForUser()`. A ticket
that is absent **or** denied by rules (non-owner) resolves the same way → the page renders a
**not-found** state (we never distinguish "missing" from "not yours", which is also the safe
answer). A read that throws for any other reason (transport, an undeployed index) returns an
**error** result so an infra failure never masquerades as not-found — the same three-way shape
US-02 uses (`data | notfound | error`). Firestore rules are **not filters**: the events query
MUST include `where("visibility","==","public")` (the read rule only exposes public events to the
owning student) or the whole query is rejected — so the read filters on visibility and sorts by
`createdAt` **in memory** (event counts per ticket are tiny). An equality filter is served by the
automatic single-field index, so **no composite index needs deploying** (adding `orderBy` on a
different field would have required one).

*Alternative:* one `collectionGroup` read — rejected; a direct doc + subcollection read is
simpler and rules-scoped.

### 2. Reply + reopen reuse the US-03 write path; a `{ from: [...] }` guard on the transition

Both actions live in `lib/actions/tickets.ts` (`"use server"`, zod, write via
`getFirestoreForUser()`, discriminated `useActionState` result — same shape as `createTicket`).

- **`replyToTicket(id, message)`** validates the message (required, trimmed, bounded), writes a
  `student_reply` event (`visibility:"public"`, `actorId=uid`, denormalized `actorName`,
  `actorRole:"student"`, message), then updates the ticket: bump `updatedAt` /
  `lastMessageAt` / `lastActorName`, and **if** the current status is `waiting_for_student`,
  set it to `assigned`. The transition is expressed as `REPLY_TRANSITION = { from:
  ["waiting_for_student"], to: "assigned" }`; from any other in-flight status the event is
  written and the status is left as-is. The ticket update is written **after** the event (same
  ordering rule as US-03: the event create rule `get()`s the parent, which can't see a
  same-batch write) — but here the event is the primary artifact, so if the *event* write fails
  the action reports an error (unlike the best-effort `created` marker on submit).

- **`reopenTicket(id)`** flips `resolved`/`closed → assigned` as a **plain field update** (status
  + `updatedAt`), guarded by `REOPEN_TRANSITION = { from: ["resolved","closed"], to:
  "assigned" }`. Per the locked decision it writes **no event** — so the mockup's "This request
  was reopened" banner is dropped (with no event we can't tell reopened-assigned from
  staff-assigned). *Alternative considered:* a `reopened` event (extend the student-authorable
  event types in the rules) — rejected to keep the story rules-free and simple; the trade-off is
  a thinner audit trail, acceptable for the MVP and reversible in US-07.

Both call `revalidatePath("/requests/[id]")` and `/requests` on success.

### 3. Comment box only for in-flight statuses; reopen for done

The rules let a student update their ticket only when the result status is `assigned` or
`waiting_for_student`. So a free comment that keeps status `resolved` would be rejected by the
rules. Rather than write an event without bumping the ticket (stale `updatedAt`), the box is
shown **only for `new` / `assigned` / `waiting_for_student`**; `resolved` / `closed` show the
**Reopen** affordance instead. This is a minor deviation from the mockup (which shows the box on
resolved) and keeps every write rules-clean. Reply-on-`waiting` also transitions → assigned;
comment-on-`new`/`assigned` is event-only.

### 4. Stepper + status presentation derive from the stored status only

A `studentStatusStyle(status)` helper (in `lib/labels.ts`, mirroring the existing
`appointmentStatusStyle`) returns the pill label + glyph + tint tokens. The stepper maps the
five statuses to positions and renders done/current/todo from the ticket's actual status — no
closed-on-read for aged resolved tickets (auto-close stays deferred). `closed` renders as the
final step current. Times are formatted deterministically via `lib/format.ts` to avoid
hydration drift (the US-04 lesson). **Active-step color deviation:** the mockup fills the
current step navy for every status except waiting (gold). In dark mode that navy dot
(`--tile` `#143252`) collapses into the navy card (`#0f2942`) — indistinguishable from a todo
step. So the **active step is gold in both themes** (done stays teal, todo outlined); the
waiting step was already gold, so this just unifies all current steps. The "action needed"
nuance the mockup encoded via gold-only-on-waiting is still carried by the gold action banner +
the status pill.

### 5. Client boundary at the leaves

`app/(student)/requests/[id]/page.tsx` is a server component (does the read, renders header /
stepper / timeline / sidebar as server markup). Only the interactive leaves are `"use client"`:
the comment box (`useActionState` on `replyToTicket`) and the reopen button
(`useActionState`/transition on `reopenTicket`). This keeps the RSC-heavy detail static-friendly
and matches the US-03/US-04 leaf-client pattern. Request-list cards link via `next/link` to
`/requests/[id]` (the list is already a client component; just add the `Link` wrapper).

## Risks / Trade-offs

- **Thin timeline on the student spine** → until US-07, most tickets show only the student's own
  `created` (and any `student_reply`) events, and the stepper sits at New/Waiting. Accepted: the
  page is built to light up when staff act; no fake data.
- **No reopen audit event** → a reopen leaves no timeline trace, and reopened-assigned looks
  identical to staff-assigned. Mitigation: `updatedAt` still moves; revisit in US-07 if the audit
  gap matters (could add a `reopened` event + a one-line rules change then).
- **Comment box hidden on resolved** (mockup shows it) → a student who wants to add context to a
  resolved ticket must Reopen first. Accepted as the rules-clean, less-ambiguous behavior;
  recorded as a deviation.
- **Not-found conflates missing and forbidden** → intentional (don't leak existence of other
  students' tickets); the error state still separates infra failures.

## Migration Plan

Additive: a new route, a new data-read module, two new actions, and a card-link tweak. No rules
deploy, no index deploy, no data migration. Ships with the web app on merge to `main` (Vercel).
Rollback = revert the change; nothing persisted needs undoing.

## Open Questions

None — the three lifecycle decisions (reopen = field-update/no-event, comment box in-flight-only,
render real status/no closed-on-read) were settled before proposing.
