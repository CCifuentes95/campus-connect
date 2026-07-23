## 1. Foundations: labels, roster read, rules

- [x] 1.1 Add staff-facing maps to `lib/labels.ts`: `staffStatusLabel` (assigned→"Assigned",
      waiting_for_student→"Waiting for student", etc.) and `staffCategoryLabel` (registration→
      "Academic", financial_aid→"Finance", it→"IT Support", …), plus staff status-actions helpers.
- [x] 1.2 Add `lib/data/staff.ts` — `getStaffRoster()`: `users where role in ['advisor','admin']`
      via `FirebaseServerApp`, returning `{uid, displayName, initials, title}` for assignee pickers.
- [x] 1.3 Relax the notification-create rule in `firestore.rules`: `allow create: if (isSelf(uid)
      || isStaff()) && <existing type-enum + read==false + exact-fields asserts>`. Pair with a
      `docs/data-model.md` note (staff may write ticket notifications into a student's inbox).
- [x] 1.4 Widen `notifyStudent` in `lib/notify.ts` if needed so a staff action can target the
      ticket's `studentId` (verify the signature already accepts an arbitrary uid).

## 2. Data reads (board + staff detail + advisor appointments)

- [x] 2.1 `lib/data/staff-tickets.ts` — `getTriageBoard(nowMs)`: single bounded fetch of all
      tickets (`orderBy updatedAt desc`, `limit N`), mapped to serializable rows (code, title,
      category, priority, status, studentName, assigneeId/Name, nextAction, createdAtMs,
      updatedAtMs, lastMessageAtMs). Return `LoadResult`-style with an error flag.
- [x] 2.2 `lib/data/staff-tickets.ts` — `getStaffTicketDetail(id)`: ticket + **all** events
      (staff read every visibility), three-way found/not_found/error (map permission-denied →
      not_found). Sort events oldest-first in memory.
- [x] 2.3 Extend `lib/data/appointments.ts` — `getAdvisorAppointments(uid)` (scoped
      `advisorId == uid`, error-vs-empty) and a staff-scoped appointment detail read.

## 3. Ticket write actions

- [x] 3.1 `lib/actions/staff-tickets.ts` scaffolding: `"use server"`, zod schemas, the
      `{ from: [...] }` transition maps, and the shared "load ticket + assert staff + append
      event after update + best-effort notify" helpers (mirror `lib/actions/tickets.ts`).
- [x] 3.2 `claimTicket` (`new→assigned`, assignee = caller, `claimed` event, notify).
- [x] 3.3 `assignTicket`/`reassignTicket` (set assignee from roster, `reassigned` event) and
      `unassignTicket` (clear assignee, `reassigned` event noting unassigned).
- [x] 3.4 `requestInfo` (`assigned→waiting_for_student`, public `message` event, `info_requested`,
      notify) and `replyToStudentAsStaff` (public `message`, →`waiting_for_student`, notify).
- [x] 3.5 `addInternalNote` (`internal_note` event, `visibility:internal`, no status change).
- [x] 3.6 `markResolved` (`assigned→resolved`, set `resolvedAt`, `resolved` event, notify) and
      `closeTicket` (`resolved→closed`, `closed` event).
- [x] 3.7 `updateTriageFields` (priority / category / nextAction edits; bump updatedAt; never
      touch status/studentId/assigneeId).
- [x] 3.8 `completeAppointment` in `lib/actions/appointments.ts` (`{from:["booked"]}`→`completed`,
      no event, unchanged studentId/advisorId).

## 4. Triage board UI (`/staff/triage`)

- [x] 4.1 Replace the stub `app/(staff)/staff/triage/page.tsx` with an RSC that computes `nowMs`
      once, calls `getTriageBoard`, and renders header + 3 KPI tiles + view/controls, passing
      serializable rows + roster to a client board component. Handle the error state.
- [x] 4.2 `components/staff/triage-board.tsx` (client): view toggle (Queue/Kanban), filter
      selects (Status/Priority/Owner/Category), sort control, "Unassigned only" switch — all
      in-memory; result count; filtered/cleared empty states.
- [x] 4.3 Queue view: two grouped tables (Needs triage · unassigned / In progress · assigned,
      "mine" rows tinted) with the columns from the spec + inline row actions (Claim gold,
      Assign/Reassign select, Unassign) wired to the actions; rows link to detail.
- [x] 4.4 Kanban view: 4 status columns of compact cards (priority, code, title, category, owner).
- [x] 4.5 Install `@dnd-kit/core` (+ sortable if needed); wire drag-and-drop on the Kanban:
      drop→named action, direct-commit for claim / mark-resolved, drop-opens-composer for
      request-info, snap-back on invalid drop, reduced-motion respected, cards keyboard-openable.

## 5. Staff ticket detail (`/staff/requests/[id]`)

- [x] 5.1 `app/(staff)/staff/requests/[id]/page.tsx` RSC: `getStaffTicketDetail`, not-found +
      error states, breadcrumb "Back to triage board", header card (code, priority, category,
      title, student chip, submitted, staff status pill).
- [x] 5.2 Activity timeline: student messages, system status events, and amber internal-note
      cards (staff-only), oldest→newest.
- [x] 5.3 Two-mode composer (client): Reply to student (teal, →waiting) vs Internal note (amber,
      no status change), zod-validated, wired to `replyToStudentAsStaff` / `addInternalNote`.
- [x] 5.4 Properties panel: status-actions card (buttons vary by status — Claim/Assign; Mark
      resolved/Request info; Close), Assignee (reassign/unassign), Priority chips, Category
      select, Next action input — wired to the actions with `useActionState` result handling.

## 6. Advisor appointment surface

- [x] 6.1 Advisor schedule view under `(staff)` — advisor's own appointments (person = student),
      cards linking to the staff appointment detail; error-vs-empty; "Set availability" stub CTA.
- [x] 6.2 Staff appointment detail — appointment fields + student party + mark-completed action
      (visible only when `booked`), not-found state.

## 7. Seed data

- [x] 7.1 Extend `functions/src/scripts/seedData.ts`: an unassigned backlog + tickets across all
      statuses with `nextAction`/internal-note events, a second staff member for reassignment,
      and advisor appointments (booked + one completed) so the board, kanban, and schedule are
      populated. Rebuild `functions/lib` and run the seed.

## 8. Verify (UI build & comparison-check process — BOTH light and dark)

- [x] 8.1 Deploy the rules change manually (`firebase deploy --only firestore`) and confirm a
      staff action creates a student notification (rejected before deploy).
- [x] 8.2 Pull the Triage Board + Staff Ticket Detail mockups via DesignSync; diff region-by-
      region (KPI tiles, grouped tables w/ colored left-bars, differentiated CTAs, status pills,
      category chips, kanban columns) against the build.
- [x] 8.3 Run the app (Playwright headless) and screenshot Triage Board (Queue + Kanban), Staff
      Ticket Detail, and the advisor schedule/detail in **light AND dark**; fix drift.
- [x] 8.4 `web-design-guidelines` review in both themes: focus-visible, aria-hidden on
      decorative icons, keyboard tab-order + kanban keyboard operability, translate="no" on
      `#REQ`/brand, line-clamp/min-w-0/tabular-nums, reduced-motion on the drag interaction.
- [x] 8.5 `pnpm lint` + `pnpm build` clean (watch the `react-hooks/purity` `nowMs()` rule);
      then mark the UI tasks done and record any justified deviation.
