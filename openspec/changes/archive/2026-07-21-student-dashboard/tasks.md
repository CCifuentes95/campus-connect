## 1. Read data-access layer

- [x] 1.1 Add `lib/firebase/firestore.ts` exporting `getFirestoreForUser()` — calls the
      existing `getAuthenticatedAppForUser()` and returns `{ db: getFirestore(app), currentUser }`
      so callers query as the signed-in user; `server-only`.
- [x] 1.2 Add view types in `lib/data/student-dashboard.ts` (`DashboardTicket`,
      `DashboardAppointment`, `StudentProfile`) — plain serializable shapes; Firestore
      `Timestamp` fields converted to epoch millis.
- [x] 1.3 Implement `getRecentTickets(uid)` — `tickets` where `studentId == uid`,
      `orderBy updatedAt desc`, capped (fetch enough to derive the open-count badge, render top 3).
- [x] 1.4 Implement `getUpcomingAppointments(uid)` — `appointments` where `studentId == uid`
      and `start >= now`, `orderBy start asc`, capped.
- [x] 1.5 Implement `getStudentProfile(uid)` — read `users/{uid}`; return null/partial safely
      when the doc or `displayName` is missing (no throw). Memoize with React `cache`.
- [x] 1.6 Wrap each query in error handling that distinguishes a failed read from an empty
      result (log + signal "load error" to the page), so an error never renders as an empty lane.

## 2. Label + formatting helpers

- [x] 2.1 Add `lib/labels.ts` mapping stored `status` → student-facing label, `category` →
      student label, and `priority` → label + brand color (per `docs/data-model.md` /
      `docs/design-brief.md`). Stored values stay canonical.
- [x] 2.2 Add a relative-time helper for "Updated <time>" and a date-tile formatter
      (month/day/weekday) for appointment cards.

## 3. Card + lane components

- [x] 3.1 Build `components/dashboard/request-card.tsx` — priority-tinted header, student
      status pill, title, category chip, `#REQ-<code>`, "Updated <time>", Open → link. Brand tokens.
- [x] 3.2 Build `components/dashboard/appointment-card.tsx` — navy date tile, service chip,
      title, time, advisor. Brand tokens.
- [x] 3.3 Build lane wrappers (header with icon, title, count badge, description, primary CTA)
      and the two empty states: Lane A "No requests yet" + suggestion chips; Lane B
      "No appointments booked".

## 4. Dashboard page

- [x] 4.1 Rewrite `app/(student)/page.tsx` as an async server component: resolve the signed-in
      uid, call the three data helpers, and render the greeting hero + two-lane grid.
- [x] 4.2 Greeting hero uses the profile `displayName` (first name) with graceful fallback to
      email / generic greeting.
- [x] 4.3 Wire Lane A (recent tickets, open-count badge, "New request" + "View all requests"
      links) and Lane B (upcoming appointments, upcoming-count badge, "Book advising" link),
      each rendering the empty state when its list is empty.
- [x] 4.4 Render the per-lane "couldn't load" inline state when a query errored (distinct from
      empty).

## 5. Profile identity in nav

- [x] 5.1 Update `app/(student)/layout.tsx` to read the profile and pass real
      `displayName`/`initials` to `TopNav`, replacing `user.email`.
- [x] 5.2 Confirm `components/nav/top-nav.tsx` renders the passed name/initials and falls back
      gracefully when absent (adjust initials derivation if needed).

## 6. Verify

- [x] 6.1 Confirm the two composite indexes (`tickets` studentId+updatedAt desc,
      `appointments` studentId+start asc) are present in `firestore.indexes.json` and deployed;
      no missing-index errors at runtime.
- [x] 6.2 `tsc`/lint clean under strict mode; no Admin SDK import on the web tier; no writes.
      (`tsc --noEmit` clean, `eslint .` clean, `next build` succeeds — `/` is dynamic, `/login`
      stays static; only `getDocs`/`getDoc` reads; firebase-admin stays in `functions/`.)
- [x] 6.3 Manually verified signed in as student@myibu.ca (Playwright): dashboard renders the
      per-lane empty state ("No requests yet" / "No appointments booked") once the composite
      indexes were deployed, and the name falls back to the email (no profile displayName).
      Populated cards + two-student isolation not yet exercised (no seeded tickets/appointments);
      queries are studentId-scoped and rules enforce ownership.
- [x] 6.4 Update roadmap note (US-01 task 6.2 "first rule-scoped server read" satisfied) and
      remove the placeholder copy.
