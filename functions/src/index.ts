/**
 * CampusConnect Cloud Functions.
 *
 * Implements US-01 (openspec/changes/auth-role-access):
 *   - onUserCreate: default `student` claim + users/{uid} profile doc
 *   - setRole:      admin-only role promotion (claim + profile mirror)
 *
 * See docs/data-model.md (users collection, claims) and
 * openspec/changes/auth-role-access/specs/role-access/spec.md.
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as functionsV1 from "firebase-functions/v1";
import { onCall, HttpsError } from "firebase-functions/v2/https";

initializeApp();

export const ROLES = ["student", "advisor", "admin"] as const;
export type Role = (typeof ROLES)[number];

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * US-01 task 3.1 — on new account: set the default `student` role claim and create the
 * users/{uid} profile doc (docs/data-model.md). The claim is authoritative; the profile
 * `role` is a display mirror.
 *
 * Uses the v1 auth background trigger (fully supported in firebase-functions v5) — simplest
 * path for default Firebase Auth without requiring Identity Platform blocking functions.
 */
export const onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
  const role: Role = "student";
  await getAuth().setCustomUserClaims(user.uid, { role });

  const displayName =
    user.displayName || (user.email ? user.email.split("@")[0]! : "Student");

  await getFirestore()
    .collection("users")
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        email: user.email ?? null,
        displayName,
        initials: initialsFrom(displayName),
        role, // display mirror — the claim is authoritative
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
});

/**
 * US-01 task 3.2 — admin-only callable that changes a user's role (claim + profile mirror).
 * Rejects non-admin callers. Effect lands on the target's next token refresh.
 */
export const setRole = onCall(async (request) => {
  if (request.auth?.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can change roles.");
  }

  const { uid, role } = (request.data ?? {}) as { uid?: string; role?: string };
  if (!uid || !role || !ROLES.includes(role as Role)) {
    throw new HttpsError(
      "invalid-argument",
      "Provide `uid` and a valid `role` (student | advisor | admin).",
    );
  }

  await getAuth().setCustomUserClaims(uid, { role });
  await getFirestore().collection("users").doc(uid).set({ role }, { merge: true });

  return { uid, role };
});

// Later user stories add: notification fan-out (US-06) and the resolved->closed
// auto-close scheduler (ADR-0002 / workflow US-05).
