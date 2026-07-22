## 1. Pull designs first (UI process step 1)

- [x] 1.1 Fetch `Book Advising.dc.html`, `Appointments.dc.html`, and `Appointment Detail.dc.html` via DesignSync (`get_file`, projectId `a3444235-8cdb-4ab1-87a9-941758dcb132` — see the `design-project-id` memory); adopt their `:root` + `.cc-dark` tokens/structure/copy verbatim
- [x] 1.2 Note any tokens/classes not yet in `app/globals.css` (e.g. slot states, step indicator, sticky summary); plan to add them rather than approximate

## 2. Advising config + slot generation

- [x] 2.1 Create `lib/advising.ts` — static config: 4 services (`academic_advising` 45m, `financial_aid` 30m, `career` 45m, `registration` 30m) with labels/durations, and 3 advisors (Priya Nair, Marcus Lee, Dr. Sofia Herrera) with the service(s) they offer + fixed working hours (weekday morning + afternoon blocks) + default `mode`/`location`
- [x] 2.2 Implement `generateSlots(advisorId, service, dateMs, existing[])` — pure function producing candidate `start`s at the service duration within working hours; flag a slot unavailable when it overlaps an `existing` appointment. Add an `overlaps(aStart,aEnd,bStart,bEnd)` helper
- [x] 2.3 Extend `lib/labels.ts` as needed (service labels/durations, mode label, appointment status badge label Booked/Completed/Cancelled)

## 3. Server actions — book / cancel / reschedule

- [x] 3.1 Create `lib/actions/appointments.ts` (mirrors `lib/actions/tickets.ts`): zod schema for booking — `service` (config enum), `advisorId` (config enum), `startMs` (validated as a real generated future slot for that advisor/service)
- [x] 3.2 `bookAppointment`: validate → student-side conflict check (read own appointments, block overlap, return the clashing appt's label) → pre-generate ref → `code="APT-"+id.slice(-6).toUpperCase()` → write (`status:"booked"`, `studentId`, denorm `studentName`/`advisorName`, `service`, `title`, `advisorId`, `start`/`end` = start+duration, `mode`, `location`); return discriminated result `{ id, code }` or error; guard no-session
- [x] 3.3 `cancelAppointment(id)`: re-read the appt, `{ from:['booked'] }` guard → update `status:"cancelled"`; keep studentId/advisorId; revalidate paths
- [x] 3.4 `rescheduleAppointment(id, startMs)`: `{ from:['booked'] }` guard → re-validate the new slot (same `generateSlots` + student conflict check) → update `start`/`end`, status stays `booked`; revalidate paths
- [x] 3.5 Add `lib/data/appointments.ts` — `getStudentAppointments` (studentId==uid, order by start; `LoadResult<T>`, serializable rows incl. `code`/`status`/`mode`/`location`) and `getAppointment(id)` (single doc, owner-scoped) for the detail page

## 4. Book Advising wizard (`/appointments/new`) — build with the skills (UI process step 2)

- [x] 4.0 Apply `frontend-design` + `next-best-practices` (RSC reads via `FirebaseServerApp`; `"use client"` at leaves; `Link`; async `params`) across groups 4–6
- [x] 4.1 Server page `app/(student)/appointments/new/page.tsx` — metadata, "Back to appointments" breadcrumb; fetch the student's existing appointments (for conflict-greying) and pass to the client wizard
- [x] 4.2 Client `booking-wizard.tsx` — 4-step indicator (Service → Advisor → Date & time → Confirm); step 1 service cards (2×2), step 2 advisor radio list, step 3 date strip + Morning/Afternoon slot grids (available / selected / unavailable states via `generateSlots`), step 4 confirm; sticky "Your appointment" summary sidebar; submit to `bookAppointment` via `useActionState`
- [x] 4.3 Booking-conflict inline alert (from the action's conflict result); confirm disabled until a valid slot is chosen
- [x] 4.4 Confirmed-success state: "You're booked in", reference `#APT-…`, appointment summary (service, advisor, date, time, location), **"View appointment" → `/appointments/[id]`** (real — built in this story) + "Book another"

## 5. Appointments list (`/appointments`)

- [x] 5.1 Server page `app/(student)/appointments/page.tsx` — fetch via `getStudentAppointments`, "Book advising" CTA → `/appointments/new`, error state distinct from empty
- [x] 5.2 Client `appointments-list.tsx` — filter tabs with counts (Upcoming / Past / All) split on `start` vs now, grouped cards reusing `components/dashboard/appointment-card.tsx` (extend for status badge + past/muted tile + cancelled dimming), per-view empty state
- [x] 5.3 Wire the dashboard "Book advising" / "Book another appointment" CTAs to `/appointments/new` (verify existing hrefs)

## 6. Appointment Detail (`/appointments/[id]`)

- [x] 6.1 Server page `app/(student)/appointments/[id]/page.tsx` — `await params`, fetch via `getAppointment`, "Back to appointments" breadcrumb, not-found handling; single-column card: status badge, service + subtitle, advisor chip, detail rows (Date & time, Format, reference `#APT-…`, optional Note)
- [x] 6.2 Client actions leaf: booked → Join (static link when `mode:"video"`), Reschedule (opens the Date & time picker → `rescheduleAppointment`), Cancel (`cancelAppointment`); cancelled → "Book again" → `/appointments/new`; completed → read-only (no actions)

## 7. Verify (UI process steps 3–5, both themes)

- [x] 7.1 Seed/ensure demo appointments, run the app, screenshot `/appointments/new` (each step + conflict + success), `/appointments` (Upcoming/Past/empty), `/appointments/[id]` (booked/cancelled) in **light AND dark**; diff region-by-region against the mockups
- [x] 7.2 `web-design-guidelines` review both themes (wizard step semantics/`aria-current`, radio/slot keyboard + `aria-pressed`/labels, `:focus-visible`, decorative `aria-hidden`, `translate="no"` on `#APT`, reduced-motion, `tabular-nums` on times)
- [x] 7.3 End-to-end (headless Playwright, isolated-scratchpad install): book an appointment → appears in `/appointments` + dashboard; open detail → reschedule → cancel; verify the student-side conflict block; confirm rules-scoping (another student can't read it). Clean up test appointments via Admin SDK after
- [x] 7.4 `tsc`, lint, and `next build` pass; record the alphanumeric-code deviation; mark UI tasks done

## 8. Document state machines (mermaid)

- [x] 8.1 Using the `mermaid-diagrams` skill, add a **ticket lifecycle** `stateDiagram-v2` to `docs/data-model.md` (replacing/augmenting the existing ASCII ticket-workflow block): `new → assigned → waiting_for_student → resolved → closed`, with the reopen (`resolved → assigned`), student-reply (`waiting_for_student → assigned`), and auto-close (`resolved → closed`) edges, labeled by the action that drives each transition
- [x] 8.2 Add an **appointment lifecycle** `stateDiagram-v2` to `docs/data-model.md`: `[*] → booked`, `booked → cancelled` (student/staff cancel), `booked → booked` (reschedule, self-loop), `booked → completed` (staff mark-completed — note US-07), terminal `cancelled`/`completed`; note appointments have no `events` audit (unlike tickets)
- [x] 8.3 Verify both diagrams render (GitHub-flavored mermaid fences) — sanity-check syntax with the mermaid skill / a render pass; keep them beside the prose they describe
