/**
 * CampusConnect Cloud Functions — SKELETON.
 *
 * Full implementation is scoped to the OpenSpec change `auth-role-access` (US-01),
 * tasks 3.1–3.2. See:
 *   - openspec/changes/auth-role-access/specs/role-access/spec.md
 *   - docs/data-model.md  (users collection, claims)
 *
 * NOTE: firebase-functions APIs (v1 auth triggers vs v2 blocking/identity, onCall)
 * differ across versions — verify the exact trigger against the installed
 * firebase-functions docs before implementing.
 */

import { initializeApp } from "firebase-admin/app";

initializeApp();

// TODO(US-01, task 3.1): onUserCreate
//   On new account: set default custom claim { role: "student" } and create the
//   users/{uid} profile doc (uid, email, displayName, initials, role mirror, createdAt)
//   per docs/data-model.md.
//   export const onUserCreate = ...

// TODO(US-01, task 3.2): setRole (admin-only callable)
//   Verify caller has the `admin` claim; set the target user's role claim among
//   student|advisor|admin; mirror `role` onto the profile doc. Reject non-admin callers.
//   The change takes effect on the target's next token refresh (getIdToken(true)).
//   export const setRole = ...

// Later user stories add: notification fan-out (US-06) and the resolved->closed
// auto-close scheduler (ADR-0002 / workflow US-05).

export {};
