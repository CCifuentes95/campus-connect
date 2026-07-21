# CampusConnect — Design Brief

Screen-by-screen UI spec and the IBU brand, transcribed from the Claude Design project
"CampusConnect Student Dashboard" (13 screens + UI kit). This is the source of truth for
layout, states, and copy. Pair it with `docs/data-model.md` (fields) and `firestore.rules`
(access). Where the design and the data model differ, the note calls it out.

---

## Brand & design system

- **Type:** Poppins (weights 400–800) as a free stand-in for the licensed Visby CF —
  geometric sans. Monospace for reference codes (`#REQ-2041`, `#APT-2048`).
- **Palette (light):** navy `#0d2c49` (primary/ink), gold `#d7a524` (accent), teal `#064948`
  (secondary), page bg `#f6f8fa`, surface `#ffffff`, border `#e2e8ef`, body text `#4a5b6b`,
  muted `#7d8b99`, field border `#b6c6d5`.
- **Priority colors:** High `#c0392b` (red), Medium `#c98a12` (amber), Low `#4a7a54` (green),
  each with a tinted background chip.
- **Full dark theme** (`.cc-dark`): every screen ships light + dark. Navy deepens to `#081826`
  bg / `#0f2942` surface; in dark, the gold accent replaces navy for active states (contrast).
- **Accent contrast rule:** gold `#d7a524` never carries small text on white (fails WCAG) —
  it's a fill behind navy ink, or a large-surface accent.
- **Shape language:** 10–20px radii, soft shadows `rgba(13,44,73,0.04)`, 1px borders.
- **Theme toggle** appears in the top nav on every screen (persist per user).

## Global patterns

**Top nav** (sticky, navy `#0d2c49`): IB monogram + "CampusConnect" + a context subtitle,
primary links, theme toggle, notifications bell (gold dot when unread), user chip
(name + sub + circular initials avatar with gold ring). Three role variants:

- **Student** subtitle "International Business University" · links: Dashboard, Requests,
  Appointments.
- **Staff** subtitle "Staff · Support workspace" · links: Triage board, My requests,
  Appointments, Reports.
- **Admin** subtitle "Admin · Program office" · links: Dashboard, Triage board, Reports, Users.

Nav collapses to a hamburger under ~1050px. Several design screens include a demo
**state/role switcher** strip (e.g. "Preview as Student / Advisor") — that is a *mock control
for reviewing states*, **not** a real feature; the live app derives role from the auth claim.

**Status vocabulary** (stored → student label / staff label): `new` → New/New ·
`assigned` → In progress/Assigned · `waiting_for_student` → Waiting for you/Waiting for student ·
`resolved` → Resolved/Resolved · `closed` → Closed/Closed. **Priority:** High / Medium / Low.

---

## Login

- **Purpose / route:** `/login`. IBU-account sign-in; role is derived automatically — there is
  **no role picker** ("Your role and view are set automatically").
- **Layout:** split screen. Left navy brand panel (headline "Student support, all in one
  place.", stat callouts "4,200+ students supported", "< 24h median first response") — hidden
  under 860px. Right form column with theme toggle.
- **Fields:** IBU email (`you@ibu.edu`), password (show/hide toggle), "Keep me signed in on
  this device" checkbox, "Forgot?" link, Sign in (gold) button, "Contact the IT service desk"
  help link.
- **States** (design exposes as tabs): default form; **success** (checkmark, "Welcome back,
  Amara", "Signed in as Student · …", auto-redirect to dashboard + Continue button);
  **wrong password** (inline field error + alert "Incorrect email or password… 2 attempts left
  before a temporary lock"); **access denied** (valid IBU account not authorised for
  CampusConnect → contact service desk); **not found** (no IBU account / non-@ibu.edu email).
- **Interactions:** success → `/` (dashboard). Maps to Firebase Auth; the "role determined by
  your account" copy reflects custom claims.

## CampusConnect Dashboard (student)

- **Purpose / route:** `/` (student home). Two support tracks side by side.
- **Layout:** greeting hero (kicker "Good morning, Amara" + title + subtitle), then a
  two-lane grid — **Lane A · Support requests** (wider) and **Lane B · Advising appointments**.
  Each lane has a header (icon, title, count badge, description, primary CTA).
- **Lane A:** "New request" CTA → Submit Support Request. Up to 3 request cards (priority-tinted
  header with priority + status pill; title; category chip; `#REQ-id` · Updated <time>; Open →
  to Track Ticket) + "View all requests →".
- **Lane B:** "Book advising" CTA. Appointment cards (navy date tile month/day/weekday; service
  chip; title; time; advisor with avatar) + dashed "Book another appointment".
- **States:** **populated** vs **new-student empty**. Empty Lane A: "No requests yet" + three
  suggestion chips (Registration & holds, Transcripts & records, Advising & planning). Empty
  Lane B: "No appointments booked". Count badges show "N open" / "N upcoming".

## Submit Support Request (student)

- **Purpose / route:** `/requests/new`. Create a ticket. Breadcrumb "Back to requests".
- **Layout:** two columns — form card + "What happens next" sidebar (3-step timeline: 1 We
  receive your request, 2 A specialist is assigned, 3 We follow up with you; + "Typical first
  response: within 1 business day").
- **Fields:** **Title*** (placeholder "e.g. Registration hold on BCOM 301"); **Category***
  (select — Registration & holds, Records & transcripts, Financial aid, Advising & planning,
  Course & enrollment, Technical support, Other); **Priority** (Low / Medium / High segmented,
  default Medium); **Description*** (textarea, 0/1000 counter). Submit request (gold) + Cancel.
- **States:** empty form; **validation errors** (top alert "Please complete the required fields"
  + inline errors under Title/Category/Description); **submitted** success (checkmark,
  "Your request has been submitted", reference `#REQ-2042`, the same 3-step timeline, "View
  request" → Track Ticket + "Back to dashboard").
- **Data:** creates a `tickets` doc `status:"new"`, `studentId`/`studentName`, chosen category
  (store canonical value) + priority; writes a `created` event.

## Track Ticket (student)

- **Purpose / route:** `/requests/[id]`. Student's view of one ticket. Breadcrumb "Back to
  requests".
- **Layout:** header (category chip, priority, `#REQ-id`, title, status pill). A **5-step
  stepper**: New → Assigned → Waiting for you → Resolved → Closed (done = teal check, current
  = navy, or gold when "Waiting for you"). Contextual **banner** by status: action-needed
  (amber, "your advisor is waiting on you", Reply now), resolved (green, Reopen request),
  reopened (teal, informational), closed. Then a two-column body: **Activity** timeline +
  comment composer, and a **Request details** sidebar.
- **Activity:** chronological events — student/advisor comments (bubbles), system status
  changes ("Status changed to Assigned"), each with actor, role chip (You/Advisor/System),
  timestamp. **Only public events show here** (internal notes are hidden). Composer: "Add a
  comment" textarea + Attach file + Post comment (a student reply moves
  waiting_for_student → assigned). When **closed**, composer is replaced by "This request is
  closed. Reopen it if you still need help." + Reopen.
- **Sidebar:** Status, Category, Priority, Created, Created by (you), Assigned advisor
  (or "Not yet assigned"), Last updated.
- **Auto-close copy:** the design shows "Ticket closed automatically 3 days after resolution"
  — this sets **N = 3 days** for the auto-close scheduled function (ADR-0002).

## Requests (student list)

- **Purpose / route:** `/requests`. All of the student's tickets. "New support request" CTA.
- **Layout:** filter tabs with counts — **All / Open / Waiting for you / Resolved** — plus a
  Sort select (Recently updated, Priority, Date opened). List of request cards (same card as the
  dashboard lane: priority-tinted header, status pill, title, category chip, `#REQ-id` · Updated,
  Open →) each linking to Track Ticket.
- **States:** populated; **empty per filter** ("No requests in this view — try another filter…").

## Book Advising (student)

- **Purpose / route:** `/appointments/new`. A guided booking flow.
- **Layout:** 4-step indicator (Service → Advisor → Date & time → Confirm) + a two-column body:
  selection cards on the left, a sticky **"Your appointment"** summary on the right.
  1. **Service** (2×2): Academic advising (45 min), Financial aid (30 min), Career services
     (45 min), Registration support (30 min).
  2. **Advisor** list: Priya Nair (Academic advising · Postgraduate), Marcus Lee (Financial aid
     & scholarships), Dr. Sofia Herrera (Career services & internships) — radio-style with tick.
  3. **Date & time:** horizontal date strip (some dates disabled), then Morning / Afternoon
     slot grids. Slot states: available / selected (navy, or gold in dark) / unavailable
     (struck-through). Legend below.
- **Summary sidebar:** Service, Advisor, Date, Time + Confirm booking (gold) + "Free to cancel
  or reschedule up to 24h before."
- **States:** slots available; **booking conflict** (red slot + inline alert "That time clashes
  with another appointment — you already have Financial aid with Marcus Lee at 10:00 AM"; confirm
  disabled); **confirmed** success ("You're booked in", calendar-invite copy, appointment
  summary card with location "Student Services, Room 214 · or join by video", Add to calendar +
  Book another).
- **Data:** creates an `appointments` doc `status:"booked"` with service, advisorId/Name,
  start/end, mode, location; conflict = overlap check against the student's other appointments.

## Appointments (student & advisor list)

- **Purpose / route:** `/appointments`. Student sees "My appointments"; advisor sees "My advising
  schedule" (same screen, role-driven — the design's Student/Advisor toggle is a preview mock).
- **Layout:** filter tabs with counts — **Upcoming / Past / All** — grouped sections. Cards:
  date tile (navy for upcoming, muted for past), service chip, **status badge** (Booked / Completed
  / Cancelled), title, time, person (student view = advisor; advisor view = "With <student>"),
  format (Video call / room), View → (student) or Open → (advisor). Cancelled cards dimmed.
- **CTA:** student "Book advising" → Book Advising; advisor "Set availability".
- **States:** populated groups; **empty per view**.

## Appointment Detail (student & staff)

- **Purpose / route:** `/appointments/[id]`. Single-column card. Breadcrumb "Back to appointments".
- **Content:** status badge (Booked/Cancelled/Completed), service + subtitle (e.g. "Academic
  advising" / "Career planning"), person chip (advisor for student, student for staff), detail
  rows — Date & time; Format ("Video call · Microsoft Teams", with Copy link when booked);
  Booking reference `#APT-2048`; optional Note ("Bring your latest transcript").
- **Actions by status × role:**
  - Student · booked: Join video call, Reschedule, Cancel appointment. Cancelled: Book again.
    Completed: none.
  - Staff · booked: Mark completed, Cancel appointment. Cancelled: Book again. Completed: none.

## Notifications (student)

- **Purpose / route:** `/notifications`. Two tabs: **Inbox** and **Preferences**.
- **Inbox:** unread-count badge; view toggle Unread / All read / Empty; "Mark all as read".
  Grouped Today / Earlier. Each row: type tile (ticket = teal, appointment = navy, system = gold),
  title (bold if unread), body, timestamp, unread dot. Types seen: ticket needs-reply, appointment
  reminder, request assigned, appointment confirmed, welcome/system. **Empty:** "You're all
  caught up".
- **Preferences:** channel matrix — rows **Ticket updates, Appointment reminders, Advisor
  messages, Announcements** × columns **Email / SMS / In-app** toggles. Banner: "Essential updates
  about your active requests are always sent by email." Footer: "Mute all non-essential" + Save
  preferences.
- **⚠ Stack note:** the design's channels are Email / **SMS** / In-app, but the project stack
  uses **FCM push**, not SMS. Build the matrix as **Email / Push / In-app** (map "In-app" to the
  `notifications` subcollection, "Push" to FCM, "Email" to a mail function). Confirm with the team
  before implementing SMS. Maps to `users.notificationPrefs` + `users/{uid}/notifications`.

## Triage Board (staff)

- **Purpose / route:** `/staff/triage`. Prioritise and assign incoming requests; unassigned work
  floats to the top. Staff-gated.
- **Layout:** header + 3 KPI tiles (**Unassigned**, **Assigned to me**, **Open total**). View
  toggle **Queue (table) / Kanban**. Controls bar: filter selects (Status, Priority, Owner,
  Category), Sort (Priority / Date submitted newest / oldest), "Unassigned only" switch.
- **Queue view:** two grouped tables — **Needs triage · unassigned** (gold left-bar) and
  **In progress · assigned** (teal left-bar; "mine" rows tinted). Columns: Priority, Request
  (title + category + `#REQ-id` · age), Status, Owner (avatar or dashed "Unassigned"), Next
  action, Actions. Unassigned row actions: **Claim** (gold) + **Assign to…** select. Assigned
  row actions: **Reassign…** select + **Unassign**. Rows link to Staff Ticket Detail.
- **Kanban view:** 4 columns — New, Assigned, Waiting for student, Resolved — with compact cards
  (priority, id, title, category, owner badge).
- **States:** busy queue; filtered ("Unassigned · High" banner + count); **cleared queue** empty
  ("The queue is clear 🎉"). Categories used staff-side: Academic, Advising, Records, Finance,
  IT Support, Career.
- **Data:** Claim = `new → assigned` sets assignee; Assign/Reassign sets assignee; Unassign clears
  it (back toward triage). Each writes an event. `nextAction` is the staff-only field shown here.

## Staff Ticket Detail (staff)

- **Purpose / route:** `/staff/requests/[id]`. Work one ticket. Breadcrumb "Back to triage board".
- **Layout:** header card (`#id`, priority, category, title, student chip, submitted, status pill).
  Two columns: **Activity + composer** (left) and a **triage/properties panel** (right).
- **Activity:** timeline of student messages, system events ("Dana Osei claimed this ticket · New
  → Assigned"), and **internal notes** (amber "Internal note · staff only" cards — never shown to
  the student).
- **Composer:** two modes — **Reply to student** (teal; "Visible to <student> — sending sets
  status to Waiting for student"; emails the student) and **Internal note** (amber; staff-only,
  no status change). Attach + Send reply / Save note.
- **Properties panel:** **Status actions** card whose buttons depend on status — New: *Claim &
  start working* / *Assign to someone else* (+ triage prompt "set priority and category, then
  claim"); Assigned: *Mark resolved* / *Request info from student*; Waiting for student: *Mark
  resolved* / *Send a reminder* (+ "Waiting on student since…" info). Then **Assignee**
  (reassign/unassign), **Priority** chips, **Category** select, **Next action** input ("shown on
  board").
- **Data:** each action is a named transition writing status + an event (public message,
  internal_note, or pure transition). Reply → `waiting_for_student`; Mark resolved → `resolved`
  (+ resolvedAt); Claim → `assigned`.

## Admin Dashboard (admin)

- **Purpose / route:** `/admin/reports` ("Reports & insight"). Program-wide metrics. Admin-gated.
  Export report button.
- **Filters:** date range (Last 30 days / 7 days / This term / Year to date), category, advisor;
  scenario tabs All categories / Advising only; active-filter chips (date range locked,
  category removable).
- **KPI cards (4):** Open requests, Avg. time to resolve (days), Appointments booked, Student
  satisfaction (/5) — each with a trend indicator vs prior period.
- **Charts:** Requests over time (line, daily/30d); **Status breakdown** donut (New, Assigned,
  Waiting for student, Resolved, Closed + total in center); **Requests by category** bars
  (Academic, Advising, Records, Finance, IT Support, Career); **Satisfaction trend** line (avg/week,
  scale 1–5).
- **Requests needing attention** table: oldest still-open requests by age — Request, Category,
  Owner (or dashed Unassigned), Status, Age (days, colored by staleness) → "Open triage board →".
- **Users** nav link → role management (admin promotes users via the `setRole` callable).
- **Data note:** per the context, reporting KPIs and the satisfaction metric **may be
  precomputed/seeded for the MVP** (Firestore has no `GROUP BY`). `rating` (1–5) lives on the
  ticket when collected.
