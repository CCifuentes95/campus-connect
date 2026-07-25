# ADR-0007: Deploy the first Cloud Functions for admin user management; model Staff as a profile field, not a claim

Status: Accepted (extends ADR-0004; refines ADR-0001)

## Context

Every account in CampusConnect is currently born either in the Firebase console or via the
local `functions/src/scripts/setRole.ts` Admin SDK script, run by an operator with
`GOOGLE_APPLICATION_CREDENTIALS`. There is no in-app way to create a user and no self-signup
anywhere in the web app (`rg createUserWithEmailAndPassword` → 0 hits; no signup route). US-08
explicitly deferred the admin "Users" screen for exactly this reason: creating an account,
deleting one, and setting a custom claim all require the Firebase **Admin SDK**, which ADR-0004
bars from running on Vercel.

Two mockups now exist (`Users.dc.html`, `User Detail.dc.html`) for a full People & access
screen. Shipping them forces two decisions this project had so far avoided.

**First: where does the privileged code run?** ADR-0004 recorded that "Cloud Functions are not
deployed (no Blaze plan)". Verified at the time of writing: the Cloud Functions API has never
been enabled on `campus-connect-503020` (`firebase functions:list` → 403 `SERVICE_DISABLED`),
so nothing — including the `onUserCreate` trigger and the `setRole` callable that already exist
in `functions/src/index.ts` — is live.

**Second: the mockups show four roles** (Student, Advisor, Staff, Admin) with their own tabs,
tiles, and pill tints, but ADR-0001 chose a **flat** model where advisor and staff are one
working tier, and `firestore.rules` encodes exactly three claim values with
`isStaff() = role in ['advisor','admin']`.

## Decision

- **Deploy Cloud Functions, but only two of them.** Add `adminManageUser` (an admin-gated
  `onCall` handling `create` | `update` | `delete`) and deploy it alongside the already-written
  `setRole` callable. This requires upgrading the Firebase project to the **Blaze**
  pay-as-you-go plan.
- **Deploy by name, never `--only functions`:**
  `firebase deploy --only functions:adminManageUser,functions:setRole`.
- **Deliberately do NOT deploy `onUserCreate`.** It unconditionally sets `role: "student"` on
  every new Auth account, so it would race with and clobber the `advisor` claim that
  `adminManageUser` writes when an admin creates an advisor or staff member. Since no
  self-signup exists, nothing needs a default-claim trigger, and an account with no claim
  already resolves to `student` in-app (`lib/firebase/session.ts`). The function stays in the
  source tree, undeployed.
- **Keep the Admin SDK off Vercel.** The web tier calls the callable through a server action;
  ADR-0004's boundary is unchanged.
- **Model Staff as a profile field, not a claim.** The custom-claim enum stays
  `student | advisor | admin`. Advisor and Staff both write the **`advisor` claim**, and a new
  display-only `staffType: 'advisor' | 'staff'` field on `users/{uid}` drives the UI's tabs,
  tiles, and pills. `isStaff()`, `lib/roles.ts`'s `Role` type, the `TopNav` role map, and the
  route-group layouts are all untouched.
- **New profile fields go on the rules denylist.** The `users/{uid}` update rule is
  `isSelf(uid) && unchanged('role') && unchanged('uid') && unchanged('email')` — a denylist, so
  `staffType`, `dept`, `cohort`, `studentId`, `cats`, and `bookable` must each be added or a
  user could self-edit them on their own profile.

## Consequences

- **Billing changes.** The project moves from Spark to Blaze. For an academic MVP at this
  traffic the cost is effectively zero (Cloud Functions' free tier is generous), but it is now
  a *metered* project and needs a budget alert.
- **A third deploy surface.** Web ships via GitHub Actions to Vercel; Firestore rules deploy
  manually; Functions now also deploy manually, and **by explicit function name**. A careless
  `firebase deploy --only functions` would deploy `onUserCreate` and silently start clobbering
  admin-assigned roles — the failure would look like "the advisor I just created is a student."
  This is the sharpest edge introduced by this ADR.
- **Role management moves in-app.** `setRole.ts` remains for bootstrapping the first admin, but
  day-to-day promotion happens at `/admin/users/[id]`.
- **`staffType` can drift from `role`.** A user demoted to student could keep a stale
  `staffType`. `adminManageUser` clears the abandoned branch's fields on every role change,
  which is the only thing keeping the two consistent — nothing in the rules enforces it.
- **Authorization is unaffected by the four-role UI.** Because Staff and Advisor share a claim,
  a "Staff" member has exactly an advisor's permissions, including reading advising
  appointments. That is the flat model working as ADR-0001 intended, but it means the UI's
  four-way split is *presentational only* and must never be read as an access boundary.
- **Deleting a user is now possible from the web tier** and is a hard delete. Historical
  attribution survives only because tickets, appointments, and events denormalize
  `studentName`/`advisorName`/`actorName`.

## Alternatives considered

- **Add a fourth `staff` claim.** Most faithful to the mockups, and would let rules distinguish
  the two tiers later. Rejected: it widens `isStaff()`, the `Role` type, the nav map, and the
  route layouts for **zero permission difference today**, and contradicts ADR-0001's flat model.
  Reversible later if staff and advisors ever need different access.
- **Overload the `role` profile mirror with four values.** No new field, but the mirror would
  deliberately disagree with the claim, breaking the invariant documented in
  `docs/data-model.md` ("display mirror of the claim") and inviting exactly the bug where
  someone reads the mirror for an access decision.
- **A Vercel route handler using the Admin SDK.** Simplest to write, and no Blaze plan needed.
  Rejected outright by ADR-0004 — it would put a service-account key on Vercel.
- **Make `onUserCreate` idempotent (read-before-write) and deploy it.** Keeps a safety net for
  console-created accounts. Rejected: extra code guarding a path nothing uses, and the
  profile-doc write stays racy against `adminManageUser`'s even when the claim write is guarded.
- **Soft-delete via a `disabled` flag.** Preserves the account for audit. Rejected: nothing in
  the app reads such a flag, so it would be dead state, and the mockup's confirmation copy
  models an explicitly permanent action.
- **Keep deferring the whole screen** and stay on the CLI. Rejected by the user: manual
  Firestore/console account creation is the specific pain this change exists to remove.
