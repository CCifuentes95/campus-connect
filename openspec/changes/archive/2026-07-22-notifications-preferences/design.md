## Context

`docs/data-model.md` already documents `users/{uid}/notifications/{notificationId}` and
`users.notificationPrefs`, and `firestore.rules` already has a `notifications` match block —
but that block was written assuming a Cloud Function fan-out (`allow create, delete: if
false`, comment "writes come from functions"). No Cloud Functions are deployed in this MVP
(AGENTS.md), and none of the events worth notifying about are staff-driven yet (US-07 triage
hasn't shipped) — every candidate trigger today is a student acting on their own ticket or
appointment. This design treats notification-creation the same way the US-03 ticket `events`
write is already treated: **a best-effort side-effect write from inside the existing server
action**, not a privileged/audited path.

## Goals / Non-Goals

**Goals:**
- Persist a notification doc whenever `replyToTicket`, `reopenTicket`, `bookAppointment`,
  `cancelAppointment`, or `rescheduleAppointment` succeeds.
- `/notifications` Inbox: unread/all-read toggle, Today/Earlier grouping, mark one or all as
  read, empty state.
- `/notifications` Preferences: full Email/Push/In-app × 4-row matrix, saved to
  `users.notificationPrefs`, with a visible "Email/Push delivery coming soon" note.
- A gold-dot unread indicator on the nav bell, student role only.

**Non-Goals:**
- `appointment_reminder` — no scheduled Cloud Function exists to produce it; deferred like
  ticket auto-close (ADR-0002). No seed data pretends this is live.
- Actually sending email or FCM push — the Preferences toggles persist intent only.
- Respecting `notificationPrefs` to *suppress* in-app writes in this change — the matrix is
  UI-complete and the field is saved, but the write-path helper below does not yet read it
  back to gate creation (see Open Questions). In-app is always-on for the 4 wired triggers.
- Staff/admin notifications — no staff-driven ticket event exists yet (US-07).

## Decisions

### 1. Notification writes are best-effort, from inside the existing action — no new rules-protected "trusted writer"

Add `lib/actions/notifications.ts` exporting a plain (non-`"use server"`-exported-as-form)
helper:

```ts
async function notifyStudent(params: {
  db: Firestore; uid: string; type: NotificationType;
  title: string; body: string; link: string; refId: string;
}): Promise<void>
```

Called from `tickets.ts`/`appointments.ts` **after** the primary transition write succeeds,
wrapped in try/catch that logs and swallows — mirroring the existing "event write is
best-effort" comment on the US-03 create path (`docs/data-model.md`). A failed notification
write must never surface as a failure of the reply/reopen/book/cancel/reschedule action the
student actually asked for.

Call sites and copy:
| Action | `type` | title / body | `link` / `refId` |
|---|---|---|---|
| `replyToTicket` | `ticket_reply` | "Reply posted" / "Your reply on {code} was posted." | `/requests/{ticketId}` |
| `reopenTicket` | `ticket_update` | "Request reopened" / "You reopened {code}." | `/requests/{ticketId}` |
| `bookAppointment` | `appointment_booked` | "Appointment booked" / "{service} with {advisorName} on {date}." | `/appointments/{id}` |
| `cancelAppointment` | `appointment_cancelled` | "Appointment cancelled" / "Your {service} appointment was cancelled." | `/appointments/{id}` |
| `rescheduleAppointment` | `appointment_booked` | "Appointment rescheduled" / "{service} moved to {date}." | `/appointments/{id}` |

**Deviation**: `rescheduleAppointment` reuses the `appointment_booked` type rather than adding
a 6th type to the data-model's enum — the Inbox only ever renders `title`/`body`, so the
`type` field is only load-bearing for the tile color (navy, per design-brief) and future
per-type preference filtering, both of which are correct for a reschedule too. Recorded here
per AGENTS.md's "record real deviations" convention; no data-model.md field change needed.

### 2. `firestore.rules` — relax `notifications` create from function-only to owner-self-authored, with validation

```
match /notifications/{notificationId} {
  allow read: if isSelf(uid);
  allow create: if isSelf(uid)
                && request.resource.data.type in
                     ['ticket_update','ticket_reply','appointment_booked',
                      'appointment_reminder','appointment_cancelled']
                && request.resource.data.read == false
                && request.resource.data.keys().hasAll(
                     ['type','title','body','link','read','createdAt','refId']);
  allow update: if isSelf(uid)
                && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);
  allow delete: if false;
}
```

This is the one **BREAKING** change flagged in the proposal — it loosens a currently
fully-closed `create`. The mitigation is that it's scoped to `isSelf(uid)` (a user can only
ever create a notification in their *own* subcollection) plus a closed `type` enum and a
`hasAll` shape check, so a signed-in student cannot forge a notification for another user or
inject arbitrary fields. `appointment_reminder` stays in the enum (rules allow it) even
though nothing writes it yet, so a future scheduled-function write doesn't need a second
rules change.

The comment "writes come from functions" is stale and gets corrected in both
`firestore.rules` and `docs/data-model.md` to describe the actual write path.

### 3. Preferences save reuses the `users` doc — no rules change needed there

`users/{uid}` update already allows `isSelf(uid)` to write any field except `role`/`uid`/
`email` (existing rule). `notificationPrefs` is just another field, so the Preferences save
action is a normal `updateDoc(userRef, { notificationPrefs })` under the existing rule — no
rules edit required for this half of the feature.

### 4. Inbox query + index

**Revised during implementation** (matches an existing convention more closely than the
original plan): a single query — `users/{uid}/notifications` ordered `createdAt desc`, no
`read` filter — is fetched once per page load; the Unread/All-read toggle and Today/Earlier
grouping are applied in-memory on the client, the same "single fetch, filter client-side"
pattern `components/requests/requests-list.tsx` already uses for the request list's filter
tabs. This needs only the automatic single-field index on `createdAt` — no composite query.
The `read ==` + `createdAt desc` composite index is still declared in `firestore.indexes.json`
(it was already present, matching `docs/data-model.md`'s index list) and deployed — it isn't
exercised by the Inbox today, but it's cheap to keep and would serve a future paginated
"unread only" query at scale. The nav bell's existence check
(`where('read','==',false).limit(1)`) is a plain equality filter and needs no composite index
either.

### 5. Nav bell — student-only prop, not a role-agnostic fetch

`components/nav/top-nav.tsx` gains an optional `hasUnread?: boolean` prop. Only
`app/(student)/layout.tsx` computes it (a cheap `where('read','==',false).limit(1)` existence
check, not a full count — the design only calls for a gold dot, not a number) and passes it
through; staff/admin layouts pass nothing, so the bell doesn't render there. This keeps
`TopNav` role-agnostic in shape (matching its existing `Record<Role, ...>` pattern) while the
actual notification feature stays student-scoped, per the decision that staff notifications
are out of scope until US-07 introduces staff-driven ticket events.

### 6. Mark-read / mark-all-read are plain server actions, not `useActionState` forms

Unlike Preferences (which has validatable input and needs `idle|error|success`), marking a
notification read is a fire-and-forget click with nothing to validate — implemented as a
plain `"use server"` function called via a small client wrapper (`startTransition`), matching
how low-stakes, non-form mutations are already handled elsewhere in the codebase rather than
forcing every mutation through the `useActionState` template reserved for actual form input.

## Risks / Trade-offs

- **[Risk]** Loosening `notifications` create from `if false` to `isSelf(uid)` is a real
  expansion of what a signed-in student can write. → **Mitigation**: closed `type` enum +
  exact-shape `hasAll` check; a student can only spam their own inbox with cosmetic rows, not
  read/write anyone else's data or affect ticket/appointment state.
- **[Risk]** Every notification in this change is self-authored (a student notifying
  themselves of their own action) — this can read as low-value "you did the thing you just
  did" noise. → **Mitigation**: accepted per the confirmed decision; framed as a receipt/audit
  trail (mirrors how the ticket `events` timeline already shows the student's own actions).
  Revisit once US-07 adds real staff-driven triggers (assigned, resolved, staff reply).
- **[Risk]** `notificationPrefs` toggles for Email/Push look functional but do nothing.
  → **Mitigation**: explicit inline "coming soon" copy on those two columns per the confirmed
  decision, so the UI doesn't overpromise.

## Migration Plan

1. Ship `firestore.rules` change + `firestore.indexes.json` addition; deploy both manually
   (`firebase deploy --only firestore`) before or alongside the web deploy — an undeployed
   index would make the Unread tab throw `failed-precondition` instead of rendering empty.
2. Ship the server-action notification writes and the `/notifications` UI in the same PR
   (no partial-rollout concern — this is additive, nothing depends on it existing yet).
3. No backfill: existing tickets/appointments simply have no notification history; the Inbox
   starts empty for all users until they take a wired action.

## Open Questions

- Should `notifyStudent` read `notificationPrefs['in_app']` (or a per-type key) before
  writing, so a student who has muted a category truly sees nothing? Deferred — the
  Preferences UI in this change saves the field but the write-path doesn't gate on it yet
  (see Non-Goals). Flagged as a natural follow-up, not blocking this change.
