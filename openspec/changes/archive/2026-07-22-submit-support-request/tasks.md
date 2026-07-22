## 1. Pull designs first (UI process step 1)

- [x] 1.1 Fetch the `Submit Support Request.dc.html` and `Requests.dc.html` mockups via DesignSync (`get_file` from the CampusConnect Student Dashboard project); adopt their `:root` + `.cc-dark` tokens/structure/copy verbatim
- [x] 1.2 Note any tokens/classes the mockups use that aren't yet in `app/globals.css`; plan to add them rather than approximate

## 2. Dependencies & rules

- [x] 2.1 Add `zod` to the web `package.json` and install — done (`zod@4.4.3`)
- [x] 2.2 Relax the `events` create rule in `firestore.rules`: in the owner branch, also permit `type == "created"` (keep `actorId == uid`, `visibility == "public"`, `ticketOwner()`)
- [x] 2.3 Deploy the rules manually (`firebase deploy --only firestore:rules`) and confirm

## 3. Server action — create ticket (first write)

- [x] 3.1 Add a write-capable Firestore accessor (extend `lib/firebase/firestore.ts` or reuse `getFirestoreForUser`) that returns the `FirebaseServerApp` db + current user for mutations
- [x] 3.2 Create `lib/actions/tickets.ts` with a zod schema: `title` (required, trimmed non-empty), `category` (canonical enum), `priority` (`low`/`medium`/`high`, default `medium`), `description` (required, ≤1000)
- [x] 3.3 Implement `createTicket` server action: validate → pre-generate ticket ref → `code = "REQ-"+ref.id.slice(-6).toUpperCase()` → write ticket (`status:"new"`, `assigneeId:null`, `studentId`, denormalized `studentName`, `createdAt`/`updatedAt`/`lastMessageAt` server timestamps, canonical category/priority)
- [x] 3.4 After the ticket write, best-effort append a `created` event (`visibility:"public"`, `actorId`=uid, `actorName`, `actorRole:"student"`); swallow + log its failure so it never fails the submission
- [x] 3.5 Return a discriminated result: field-level validation errors OR success with `{ id, code }`; guard against no-session

## 4. Submit Support Request screen (`/requests/new`) — build with the skills (UI process step 2)

- [x] 4.0 Apply `frontend-design` (visual direction only where the mockup leaves gaps) and `next-best-practices` (RSC reads via `FirebaseServerApp`; `"use client"` at leaves; `viewport`/`theme-color`; `Link`; async `cookies()`/`params`) while building groups 4 and 5
- [x] 4.1 Server component `app/(student)/requests/new/page.tsx` — metadata, "Back to requests" breadcrumb, static "What happens next" 3-step sidebar; client boundary at the form leaf
- [x] 4.2 Client `request-form.tsx` using `useActionState` against `createTicket`: Title, Category select, Priority segmented (default Medium), Description textarea with 0/1000 counter; Submit (gold) + Cancel
- [x] 4.3 Validation-error state: top alert + inline errors under Title/Category/Description from the action's returned errors
- [x] 4.4 Submitted success state: checkmark, "Your request has been submitted", reference `#REQ-…`, the same 3-step timeline, "View request" → `/requests` (US-05 rewires to `/requests/[id]`) + "Back to dashboard"

## 5. Requests list screen (`/requests`)

- [x] 5.1 Add `getStudentTickets` in `lib/data/` — single query `studentId == uid` + `orderBy updatedAt desc` via `FirebaseServerApp`, returning `LoadResult<T>` (error distinct from empty), serializable rows
- [x] 5.2 Server component `app/(student)/requests/page.tsx` — fetch, "New support request" CTA, error state; pass rows to the client list
- [x] 5.3 Client `requests-list.tsx` — filter tabs with counts (All / Open / Waiting for you / Resolved) + sort select (Recently updated / Priority / Date opened), filtering & sorting in-memory; reuse `components/dashboard/request-card.tsx`
- [x] 5.4 Per-filter empty state ("No requests in this view — try another filter") vs whole-page empty state
- [x] 5.5 Wire the dashboard "View all requests →" and "New request" CTAs to `/requests` and `/requests/new`

## 6. Verify (UI process steps 3–5, both themes)

- [x] 6.1 Seed demo tickets, run the app, screenshot `/requests/new` (empty, validation, submitted) and `/requests` (populated + per-filter empty) in **light AND dark**; diff region-by-region against the mockups
- [x] 6.2 `web-design-guidelines` review in both themes (`:focus-visible`, `aria-hidden` on decorative icons, skip link/`#main`, `translate="no"` on `#REQ`, reduced-motion, `line-clamp`/`min-w-0`/`tabular-nums`, keyboard tab-order)
- [x] 6.3 End-to-end check: submit a request as a test student → appears in `/requests` and on the dashboard; verify the `created` event landed and rules-scoping holds (another student can't read it)
- [x] 6.4 `tsc`, lint, and `next build` pass; record the alphanumeric-code deviation; mark UI tasks done
