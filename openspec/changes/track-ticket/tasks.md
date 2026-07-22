## 1. Pull design first (UI process step 1)

- [x] 1.1 Fetch `Track Ticket.dc.html` via DesignSync (`get_file`, projectId `a3444235-8cdb-4ab1-87a9-941758dcb132` — see the `design-project-id` memory); adopt its `:root` + `.cc-dark` tokens/structure/copy verbatim. Ignore the mockup's top **status switcher** (a demo-only control) and the **Attach file** button (no Storage in the MVP)
- [x] 1.2 Note any tokens/classes not yet in `app/globals.css` (stepper dot states, action/resolved banner tints `--warn`/`--ok`/teal, timeline avatars + role chips, comment-box field) and plan to add them rather than approximate

## 2. Labels + detail read

- [x] 2.1 Add `studentStatusStyle(status)` to `lib/labels.ts` (mirrors `appointmentStatusStyle`): returns pill label + glyph/icon name + tint tokens for `new`/`assigned`/`waiting_for_student`/`resolved`/`closed`; reuse the existing `studentStatusLabel`. Add a `STATUS_STEPS` order + a helper mapping a status to a stepper position (done/current/todo)
- [x] 2.2 Create `lib/data/ticket-detail.ts` — `getTicketDetail(id)` (React `cache`): `getDoc(tickets/{id})` + `getDocs(events, orderBy("createdAt","asc"))` via `getFirestoreForUser()`. Return a three-way `LoadResult`-style shape: found ticket + serializable events / **not-found** (absent OR permission-denied, conflated deliberately) / **error** (other throws). Map event rows to serializable fields (type, actorName, actorRole, visibility, message, fromStatus/toStatus, createdAtMs)

## 3. Server actions — reply / reopen (add to `lib/actions/tickets.ts`)

- [x] 3.1 `replyToTicket(prev, formData)` — zod-validate the message (required, trimmed, ≤1000); guard no-session; write a `student_reply` event (`visibility:"public"`, `actorId=uid`, denorm `actorName`, `actorRole:"student"`, message, `createdAt`), then update the ticket: bump `updatedAt`/`lastMessageAt`/`lastActorName`, and via `REPLY_TRANSITION={ from:["waiting_for_student"], to:"assigned" }` set status→assigned only when currently waiting (else leave status). Event write is primary → its failure returns an error (unlike US-03's best-effort `created` marker). Discriminated `useActionState` result; `revalidatePath` `/requests/[id]` + `/requests`
- [x] 3.2 `reopenTicket(prev, formData)` — guard no-session; re-read the ticket; `REOPEN_TRANSITION={ from:["resolved","closed"], to:"assigned" }` guard → **plain field update** status→assigned + `updatedAt` (NO event written — per decision; keep `studentId`/`assigneeId` unchanged). Discriminated result; revalidate the same paths
- [x] 3.3 Keep both actions rules-clean: both land on `assigned`, so the existing `tickets` update rule permits them — confirm no `firestore.rules` edit is needed

## 4. Track Ticket page — build with the skills (UI process step 2)

- [x] 4.0 Apply `frontend-design` + `next-best-practices` across groups 4–5 (RSC read via `FirebaseServerApp`; `"use client"` only at the write leaves; `await params`; `Link`; deterministic time formatting via `lib/format.ts` to avoid hydration drift)
- [x] 4.1 Server page `app/(student)/requests/[id]/page.tsx` — `await params`, fetch via `getTicketDetail`; render the not-found state (own not-found copy + "Back to requests") and the error state distinctly; metadata (title incl. `#REQ` code); "Back to requests" breadcrumb → `/requests`
- [x] 4.2 Header + stepper (server markup): category chip, priority glyph, `translate="no"` `#REQ-…` code, title, status pill (`studentStatusStyle`); 5-step stepper (New → Assigned → Waiting for you → Resolved → Closed) with done/current/todo dot styling from the ticket's stored status — **no closed-on-read** for aged resolved tickets
- [x] 4.3 Conditional action banner: `waiting_for_student` → gold "Action needed — reply below"; `resolved`/`closed` → green "Resolved — reopen?" with the reopen affordance. (No "reopened" banner — reopen writes no event.) Details sidebar: status, category, priority, created time, created-by (you), assigned advisor or "Not yet assigned", last-updated
- [x] 4.4 Activity timeline (server markup): map the public events oldest-first → person vs. system rows (avatar/initials vs. gear), role chip, deterministic time; `student_reply`/`created` with a message render as comment bubbles, status-transition events render a "status changed to …" chip; connector line between rows

## 5. Write leaves (client) + list wiring

- [x] 5.1 `components/requests/comment-box.tsx` (`"use client"`) — shown only for `new`/`assigned`/`waiting_for_student`; textarea + Post comment; `useActionState` on `replyToTicket`; inline validation error; disabled/pending state; no Attach-file button
- [x] 5.2 `components/requests/reopen-button.tsx` (`"use client"`) — shown for `resolved`/`closed`; `useActionState`/transition on `reopenTicket`; used in both the action banner and the closed-state comment-area placeholder ("This request is closed. Reopen it if you still need help.")
- [x] 5.3 Wire request-list cards to the detail route: wrap each card in `components/requests/requests-list.tsx` with `next/link` → `/requests/[id]` (fulfills the existing list requirement; the route didn't exist before). Verify the dashboard "recent requests" cards link too, if present

## 6. Verify (UI process steps 3–5, both themes)

- [x] 6.1 Seed demo tickets across statuses (`new`, `assigned`, `waiting_for_student`, `resolved`, `closed`) with a few public events; run the app; screenshot `/requests/[id]` for each status in **light AND dark**; diff region-by-region against `Track Ticket.dc.html` (stepper dots, banner tints, timeline bubbles/chips, sidebar rows)
- [x] 6.2 `web-design-guidelines` review both themes: stepper `aria-current`/step semantics, timeline landmark/list semantics, comment textarea label + error `aria-describedby`, `:focus-visible`, decorative icons `aria-hidden`, `translate="no"` on `#REQ`, reduced-motion, `tabular-nums` on times, keyboard tab-order through banner → timeline → comment box
- [x] 6.3 End-to-end (headless Playwright, isolated-scratchpad install): open a `waiting_for_student` ticket → reply → verify `student_reply` event appears and status flips to `assigned`; open a `resolved` ticket → reopen → verify status `assigned` and NO new event; open an `assigned` ticket → comment → status unchanged; confirm a non-owner gets the not-found state (rules-scoping). Clean up any test data via the Admin SDK after
- [x] 6.4 `tsc`, lint, and `next build` pass; confirm no `firestore.rules`/index deploy is needed; record the deviations (no reopened banner, no attach-file, comment box hidden on resolved, real-status/no closed-on-read); mark the UI tasks done
