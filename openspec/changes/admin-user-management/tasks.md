## 1. Groundwork

- [x] 1.1 Re-pull `Users.dc.html` and `User Detail.dc.html` via DesignSync; confirm the
      mockups' `:root`/`.cc-dark` token values already exist in `app/globals.css`, port any new
      ones verbatim
- [x] 1.2 Confirm the Blaze plan is enabled on the Firebase project (manual console step) —
      blocks every functions-deploy task below
- [x] 1.3 Write the ADR for deploying Cloud Functions in this MVP (Context → Decision →
      Consequences → Alternatives): why `adminManageUser` + `setRole` deploy but `onUserCreate`
      deliberately does not, and why Advisor/Staff is `staffType` rather than a 4th claim.
      Reference ADR-0004

## 2. Data model & rules

- [x] 2.1 Add `staffType`, `dept`, `cohort`, `studentId`, `cats`, `bookable` to the
      `users/{uid}` table in `docs/data-model.md`, noting `cats` uses the mockup's six labels
      verbatim (not the ticket `category` enum) and that `role` remains a claim mirror
- [x] 2.2 Replace the `users/{uid}` self-update **denylist** with an allowlist —
      `diff(resource.data).affectedKeys().hasOnly(['notificationPrefs'])`. A per-field
      `unchanged()` denylist would ERROR on absent fields and lock students out of saving
      notification preferences (see design.md)
- [x] 2.3 Update the stale rules comment that says profiles are created by `onUserCreate` —
      they are now created by `adminManageUser`
- [x] 2.4 Deploy rules: `firebase deploy --only firestore:rules`

## 3. Cloud Function: adminManageUser

- [x] 3.1 Extract the claim-write + profile-mirror logic from the existing `setRole` callable
      (`functions/src/index.ts:66`) into a shared helper; leave `setRole` exported and working
- [x] 3.2 Add `adminManageUser` as an `onCall` in `functions/src/index.ts`; reject unless
      `request.auth?.token.role === "admin"` **before any write**, matching `setRole`'s guard
- [x] 3.3 Implement `action: 'create'` — Auth `createUser`, set the claim (`advisor` for both
      Advisor and Staff), write `users/{uid}` with `uid`/`email`/`displayName`/`initials`/
      `role`/`createdAt` plus the role branch: `program`/`cohort`/`studentId` (auto-generate
      when blank) for Student, `staffType`/`dept`/`title`/`cats`/`bookable` for Advisor/Staff
- [x] 3.4 Implement `action: 'update'` — update Auth email/password when supplied, update the
      claim on role change, write profile fields, and **clear the abandoned branch's fields**
      when the role crosses the student↔staff boundary
- [x] 3.5 Implement `action: 'delete'` — reject when `uid === request.auth.uid` (self-delete
      guard), else delete the Auth account and the `users/{uid}` doc
- [x] 3.6 zod-validate every payload inside the function before any write; enforce the
      8-character minimum password and reject a duplicate email with a distinguishable error
      code the UI can map to a field error
- [x] 3.7 **Verify callable auth over `FirebaseServerApp`** — it FAILED (intermittently:
      `getImmediate` returns null under a server app and the async provider fill races
      `getAuthToken`). Transport switched to an explicit bearer-token POST of the callable
      protocol from the server action; kept out of the client. design.md updated
- [x] 3.8 Deploy exactly two functions:
      `firebase deploy --only functions:adminManageUser,functions:setRole` — **not**
      `--only functions`, which would also deploy `onUserCreate`
- [x] 3.9 Confirm in the Firebase console that `onUserCreate` is not deployed

## 4. Server action

- [x] 4.1 Add `lib/actions/admin-users.ts` following the `useActionState` discriminated result
      (`idle | error{fieldErrors,values} | success`) pattern from `lib/actions/tickets.ts`
- [x] 4.2 zod-validate at the boundary (name, email format, password ≥ 8, role in
      Student/Advisor/Staff for create), then invoke `adminManageUser`
- [x] 4.3 Map callable `HttpsError` codes to `fieldErrors` (duplicate email → email field,
      short password → password field, permission-denied → form-level)
- [x] 4.4 `revalidatePath("/admin/users")` and the `[id]` path on success

## 5. UI: /admin/users roster

- [x] 5.1 Create `app/(admin)/admin/users/page.tsx` — RSC read of `users` via
      `FirebaseServerApp`, single-field `orderBy`, counts/tabs/search/sort computed in memory
      (no composite index), matching the staff triage board's read pattern
- [x] 5.2 Header ("People & access" + gold "Create user" button) and the subtitle count line
- [x] 5.3 Four summary tiles — Students, Advisors ("N bookable this term"), Support staff,
      Administrators — with teal-tinted icon squares
- [x] 5.4 Five role tabs with counts (Everyone/Students/Advisors/Staff/Admins); Advisors and
      Staff filter on `staffType`, not on the claim
- [x] 5.5 Search field (name, email, programme/department, student ID) with a Clear affordance
- [x] 5.6 Sortable table: Person (avatar + name/email), Role pill, Program / department
      (hidden ≤940px), **Joined** (from `createdAt` — deviation from the mockup's "Last
      active"), Actions (open profile + delete); footer count and sort labels; empty state
- [x] 5.7 Create-user modal: three role cards (Student/Advisor/Staff), conditional Student
      record vs. Advisor/Staff profile sections, six category chips, Advisor-only bookable
      switch, password field with Generate (reveals) + show/hide, per-field validation after
      first submit, role-switch field resets, and the footer permission note
- [x] 5.8 Wire create/delete via `useTransition` calling the server action directly then
      `router.refresh()` (the US-07 board-control pattern — this screen fires several different
      actions, so not `useActionState`/`<form action>`)
- [x] 5.9 Delete-confirm modal reusing the mockup's copy ("This permanently removes the account
      and its sign-in credentials. Their past requests stay in the system, attributed to a
      removed user. This can't be undone.")

## 6. UI: /admin/users/[id] detail

- [x] 6.1 Create `app/(admin)/admin/users/[id]/page.tsx` (remember `params` is async) — header
      with avatar, name, role pill, and Delete/Save actions; two-column layout
- [x] 6.2 Edit form matching the create fields, plus Admin as a selectable role here
- [x] 6.3 Role-change warning banner (access changes; lands on next token refresh)
- [x] 6.4 Sidebar: account meta, recent activity / current workload, access summary
- [x] 6.5 Wire Save/Delete to the server action; hide or disable Delete on the signed-in
      admin's own profile

## 7. Nav

- [x] 7.1 Re-enable the admin "Users" link in `components/nav/top-nav.tsx` and remove the
      deferral comment
- [x] 7.2 Confirm the `(admin)` layout guard already covers the new routes (no layout change
      expected)

## 8. Verification

> Pre-existing, out of scope: `TopNav` overflows the viewport below ~420px for EVERY role
> (student dashboard 669px @380px vs. these admin pages' 606px). The mockups have a
> `cc-nav-toggle` hamburger at <=1080px that the app never implemented. Not introduced here.

- [x] 8.1 Screenshot `/admin/users` and `/admin/users/[id]` in **both light and dark** with
      headless Playwright from the scratchpad; diff region-by-region against the two mockups
- [x] 8.2 `web-design-guidelines` review in both themes — `:focus-visible`, `aria-hidden` on
      decorative icons, the password toggle's `aria-label`, the bookable `role="switch"` +
      `aria-checked`, keyboard tab order through chips and role cards, `line-clamp`/`min-w-0`,
      reduced motion
- [x] 8.3 End-to-end against the real Firebase project: create a Student, an Advisor, and a
      Staff account; verify each one's claim, `role` mirror, and `staffType`; sign in as the
      new advisor and confirm staff-route access
- [x] 8.4 Verify rejection paths: non-admin calling `adminManageUser`, self-delete, duplicate
      email, sub-8-character password
- [x] 8.5 Verify a student cannot self-write `staffType`/`cats`/`bookable` to their own profile
      after the rules deploy
- [x] 8.6 Delete a test account that appears on an existing ticket or appointment; confirm the
      denormalized name still renders
- [x] 8.7 Clean up all test accounts created during verification

## 9. Ship

- [ ] 9.1 Open the PR with a thorough body and both-theme screenshots
- [ ] 9.2 Merge, then verify the commits landed in `main` (`git merge-base --is-ancestor`)
- [ ] 9.3 `/opsx:sync` the `admin-user-management` and `role-access` deltas into
      `openspec/specs/`, then `/opsx:archive`
- [ ] 9.4 Update `AGENTS.md` — Cloud Functions are now partly deployed; the deploy command is
      function-scoped on purpose; the `staffType` pattern; the callable-from-server-action
      transport
- [ ] 9.5 Document learnings to memory and the Obsidian vault
