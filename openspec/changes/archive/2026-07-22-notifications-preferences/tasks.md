## 1. Pull design first (UI process step 1)

- [x] 1.1 Fetch the Notifications mockup via DesignSync `get_file` (CampusConnect Student
      Dashboard project — see the `design-project-id` memory); adopt its `:root` + `.cc-dark`
      tokens/structure/copy verbatim for the Inbox and Preferences tabs. Ignore anything that
      implies live email/SMS send — the design's SMS column is replaced with Push per the
      already-recorded stack deviation (`docs/design-brief.md`). Also ignored the mockup's
      "Empty" view-toggle button — a demo-only preview control (same category as prior
      mockups' status switchers), not a real production affordance; the real Inbox naturally
      renders the empty state when a filtered view has zero items.
- [x] 1.2 Noted tokens not yet in `app/globals.css`; most (`--tile`/`--tile-soft`/`--field`/
      `--card-shadow`/`--btn2*`/`--teal-tint`) already matched the mockup's values exactly.
      Added the three that didn't exist: `--unread-bg`, `--toggle-on`, `--toggle-off` (light +
      dark + `@theme inline` mappings).

## 2. Firestore rules + indexes

- [x] 2.1 Updated `firestore.rules` `users/{uid}/notifications` match: replaced
      `allow create, delete: if false` with `allow create: if isSelf(uid) && ...` (closed
      `type` enum, `read == false`, `hasAll` field-shape check); `allow delete: if false`
      kept; owner-only `read`-field-only `allow update` kept. Corrected the stale comment.
- [x] 2.2 The `read ==` + `createdAt desc` composite index was **already declared** in
      `firestore.indexes.json` — no change needed there.
- [x] 2.3 Deployed: `firebase deploy --only firestore` — rules compiled and released,
      indexes deployed, confirmed via CLI output.
- [x] 2.4 Updated `docs/data-model.md`'s notifications subcollection note to describe the
      actual server-action write path instead of a Cloud Function fan-out.

## 3. Notification write-path helper

- [x] 3.1 Created `notifyStudent({ db, uid, type, title, body, link, refId })` — **in
      `lib/notify.ts`, not `lib/actions/notifications.ts`**: a `"use server"` module's
      exports must take serializable args (Server Action contract), and this helper takes a
      `Firestore` instance, so it can't live in an action file. `addDoc`s to
      `users/{uid}/notifications` with `read:false`/`createdAt:serverTimestamp()`, try/catch
      logs-and-swallows (best-effort, matches the US-03 event-write pattern).
      `lib/actions/notifications.ts` holds only the real form-bound actions (mark-read,
      mark-all-read, save-preferences).
- [x] 3.2 Added `NOTIFICATION_TYPES`/`NotificationType` in `lib/notifications.ts` (inline copy
      per call site, per the table, rather than a shared copy map — each site's copy needs a
      different interpolated value).

## 4. Wire notification writes into existing server actions

- [x] 4.1 `replyToTicket` — `ticket_reply` after the event + status bump, linking to the ticket.
- [x] 4.2 `reopenTicket` — `ticket_update` after the status update, linking to the ticket.
- [x] 4.3 `bookAppointment` — `appointment_booked` after creation, linking to the appointment.
- [x] 4.4 `cancelAppointment` — `appointment_cancelled` after the transition.
- [x] 4.5 `rescheduleAppointment` — reuses `appointment_booked` with "rescheduled" copy.

## 5. Inbox + mark-read server actions

- [x] 5.1 Added `lib/data/notifications.ts` — `getNotifications()` (React `cache`): **a
      single query** (`createdAt desc`, no `read` filter) rather than a per-view query —
      revised during implementation to match the existing `requests-list.tsx` "single fetch,
      filter client-side" convention (see design.md decision 4's update). Unread/All-read
      toggle + Today/Earlier grouping are done client-side. Distinguishes read-failure from
      empty. Also added `getNotificationPrefs()` and `hasUnreadNotifications()` (the latter
      genuinely uses `where('read','==',false).limit(1)` for the nav bell).
- [x] 5.2 Added `markNotificationRead` and `markAllNotificationsRead` in
      `lib/actions/notifications.ts` — update only `read`, single doc / `writeBatch`.

## 6. Preferences server action

- [x] 6.1 No zod schema — deviation: a checkbox-matrix has no invalid input shape (every
      field is a boolean, absent = false), so there's nothing for zod to reject; `savePreferences`
      still follows the discriminated `useActionState` idle/error/success template for
      surfacing write failures, `updateDoc`ing the caller's own `users/{uid}` doc.
- [x] 6.2 `muteNonEssential()` in `lib/notifications.ts` — a client-side preset wired to the
      "Mute all non-essential" button, mirroring the mockup's exact logic (keeps the full
      Ticket-updates row on, plus Appointment-reminders' Email, clears everything else).

## 7. Notifications page (build with the skills — UI process step 2)

- [x] 7.0 Applied `frontend-design` + `next-best-practices`: RSC read via `FirebaseServerApp`;
      `"use client"` only at the interactive leaves (tabs, toggles, mark-read); `now` computed
      once server-side (`lib/notifications.ts` `nowMs()`, matching `lib/advising.ts`'s existing
      wrapper) and passed down so Today/Earlier grouping can't drift between server and client
      renders.
- [x] 7.1 `app/(student)/notifications/page.tsx` — client-state Inbox/Preferences tabs (not
      searchParams — both tabs' data is fetched once and passed down), metadata, error state
      distinct from empty.
- [x] 7.2 `components/notifications/notification-row.tsx` — type tile, bold-if-unread title,
      body, relative timestamp, unread dot; clicking navigates to `link` AND marks read
      (fire-and-forget), matching the mockup (no separate per-row mark-read control shown).
- [x] 7.3 `components/notifications/preferences-form.tsx` — the 4×3 toggle matrix (custom
      switch UI over a `sr-only` checkbox, `peer-focus-visible` ring), inline "coming soon"
      note (`aria-describedby`'d from Email/Push toggles), Mute-all + Save via `useActionState`.

## 8. Nav bell

- [x] 8.1 `components/nav/top-nav.tsx` — optional `hasUnread?: boolean` prop; bell (linking to
      `/notifications`) renders only when the prop is passed (`undefined` hides it entirely).
- [x] 8.2 `app/(student)/layout.tsx` computes `hasUnread` via `hasUnreadNotifications()` and
      passes it; staff/admin layouts pass nothing — confirmed via Playwright that a bare
      `TopNav` render with no prop shows no bell.

## 9. Seed data

- [x] 9.1 Extended `functions/src/scripts/seedData.ts` with 5 notifications across all 4 wired
      types (two unread/Today, three read/Earlier), referencing real seeded ticket/appointment
      ids. No fake `appointment_reminder` rows.

## 10. Verify (UI process steps 3–5, both themes)

- [x] 10.1 Ran the app; triggered reply, reopen, book (already seeded), cancel, and reschedule
      via headless Playwright — each produced the matching notification. Screenshotted
      `/notifications` Inbox and Preferences in light AND dark; visually matches the mockup
      (tile colors, unread bg/dot, tab badge, matrix layout, banner copy, toggle track colors).
- [x] 10.2 Accessibility pass: added `role="tablist"/"tab"`/`aria-selected` to the main
      Inbox/Preferences tabs (`role="group"`/`aria-pressed` on the Unread/All-read toggle,
      matching the existing `requests-list.tsx` filter-tab convention); `aria-describedby` from
      Email/Push toggles to the "coming soon" note; all decorative SVGs `aria-hidden`;
      `peer-focus-visible` ring added on the toggle track (the native checkbox itself is
      `sr-only`, so the visible focus ring needed explicit wiring); reduced-motion already
      covered by the existing global rule. Verified keyboard Tab order reaches the toggle
      inputs directly.
- [x] 10.3 End-to-end (headless Playwright, isolated-scratchpad install): reply → unread
      `ticket_reply` appears → mark-all-as-read → Inbox empties → nav bell dot clears after
      reload; toggled + saved a preference → reload → confirmed persistence; reopen + cancel
      flows each produced their notification. Test-created notification docs cleaned up via
      the Admin SDK after (reseeded to restore the 5 canonical demo rows).
- [x] 10.4 `tsc --noEmit`, `eslint`, and `next build` all pass (2 harmless
      `no-unused-vars` warnings on `markAllNotificationsRead`'s unused `_prev`/`_formData`
      params — required by the `useActionState` action signature; not errors, build unaffected).
      Rules + index deploy confirmed live. Deviations recorded above and in design.md.
