/**
 * CampusConnect Cloud Functions.
 *
 * US-01 (openspec/changes/auth-role-access):
 *   - onUserCreate:    default `student` claim + users/{uid} profile doc
 *   - setRole:         admin-only role promotion (claim + profile mirror)
 * admin-user-management (ADR-0007):
 *   - adminManageUser: admin-only create / update / delete of accounts
 *
 * DEPLOY BY NAME — never `firebase deploy --only functions`:
 *
 *   firebase deploy --only functions:adminManageUser,functions:setRole
 *
 * `onUserCreate` must stay UNDEPLOYED. It hard-sets `role:"student"` on every new Auth
 * account, so deploying it would race with and clobber the claim adminManageUser assigns
 * when an admin creates an advisor or staff member. There is no self-signup in the app, so
 * nothing needs a default-claim trigger, and a claimless account already resolves to
 * `student` in-app (lib/firebase/session.ts). See ADR-0007.
 *
 * See docs/data-model.md (users collection, claims) and
 * openspec/changes/auth-role-access/specs/role-access/spec.md.
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as functionsV1 from "firebase-functions/v1";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { z } from "zod";

initializeApp();

export const ROLES = ["student", "advisor", "admin"] as const;
export type Role = (typeof ROLES)[number];

/**
 * The UI shows four roles; the custom claim only has three. Advisor and Staff are the SAME
 * claim (`advisor`) — they differ only by the display-only `staffType` profile field, so
 * `isStaff()` in firestore.rules stays untouched. See ADR-0007.
 */
export const UI_ROLES = ["student", "advisor", "staff", "admin"] as const;
export type UiRole = (typeof UI_ROLES)[number];

/** UI role -> (authoritative claim, display-only staffType). */
function resolveRole(uiRole: UiRole): { role: Role; staffType: string | null } {
  if (uiRole === "staff") return { role: "advisor", staffType: "staff" };
  if (uiRole === "advisor") return { role: "advisor", staffType: "advisor" };
  return { role: uiRole, staffType: null }; // student | admin carry no staffType
}

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Writes the authoritative claim and mirrors `role` onto the profile doc for display. */
async function writeRole(uid: string, role: Role, extra: Record<string, unknown> = {}) {
  await getAuth().setCustomUserClaims(uid, { role });
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set({ role, ...extra }, { merge: true });
}

/** Every admin-only callable starts here. Throws before any write when the caller isn't admin. */
function assertAdmin(request: CallableRequest): string {
  if (request.auth?.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can manage users.");
  }
  return request.auth.uid;
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
  assertAdmin(request);

  const { uid, role } = (request.data ?? {}) as { uid?: string; role?: string };
  if (!uid || !role || !ROLES.includes(role as Role)) {
    throw new HttpsError(
      "invalid-argument",
      "Provide `uid` and a valid `role` (student | advisor | admin).",
    );
  }

  await writeRole(uid, role as Role);

  return { uid, role };
});

// ---------------------------------------------------------------------------
// admin-user-management (ADR-0007) — admin-only account create / update / delete
// ---------------------------------------------------------------------------

/** Verbatim from the Users / User Detail mockups — deliberately NOT the ticket category enum. */
const CATEGORIES = [
  "Advising",
  "Academic",
  "Records",
  "Finance",
  "IT Support",
  "Career",
] as const;

const profileFields = {
  displayName: z.string().trim().min(1, "Enter the person's full name."),
  // student branch
  program: z.string().trim().optional(),
  cohort: z.string().trim().optional(),
  studentId: z.string().trim().optional(),
  // staff branch
  dept: z.string().trim().optional(),
  title: z.string().trim().optional(),
  cats: z.array(z.enum(CATEGORIES)).optional(),
  bookable: z.boolean().optional(),
};

const createSchema = z.object({
  action: z.literal("create"),
  // Admin is deliberately not creatable here — promote an existing account instead.
  uiRole: z.enum(["student", "advisor", "staff"]),
  email: z.email("Enter a valid university email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  ...profileFields,
});

const updateSchema = z.object({
  action: z.literal("update"),
  uid: z.string().min(1),
  uiRole: z.enum(UI_ROLES),
  email: z.email("Enter a valid university email."),
  // blank means "keep the current password"
  password: z.string().refine((p) => p.length === 0 || p.length >= 8, {
    message: "Password must be at least 8 characters.",
  }),
  ...profileFields,
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  uid: z.string().min(1),
});

const payloadSchema = z.discriminatedUnion("action", [
  createSchema,
  updateSchema,
  deleteSchema,
]);

type ProfileInput = z.infer<typeof createSchema> | z.infer<typeof updateSchema>;

/** Mirrors the mockup's own create/save behaviour: the non-selected branch is cleared. */
function profileForRole(input: ProfileInput, uiRole: UiRole) {
  const { role, staffType } = resolveRole(uiRole);
  const isStudent = uiRole === "student";
  const displayName = input.displayName.trim();

  return {
    role,
    staffType,
    displayName,
    initials: initialsFrom(displayName),
    email: input.email.trim().toLowerCase(),
    // student branch — cleared for staff/advisor/admin
    program: isStudent ? (input.program ?? "") : "",
    cohort: isStudent ? (input.cohort ?? "") : "",
    studentId: isStudent
      ? input.studentId?.trim() || `S-${21100 + Math.floor(Math.random() * 800)}`
      : "",
    // staff branch — cleared for students
    dept: isStudent ? "" : (input.dept ?? ""),
    title: isStudent
      ? ""
      : input.title?.trim() || (uiRole === "advisor" ? "Academic advisor" : "Support staff"),
    cats: isStudent ? [] : (input.cats ?? []),
    // only advisors publish an advising calendar
    bookable: uiRole === "advisor" ? (input.bookable ?? false) : false,
  };
}

/** Firebase Auth's duplicate-email error, surfaced so the UI can attach it to the field. */
function rethrowAuthError(err: unknown): never {
  const code = (err as { code?: string })?.code;
  if (code === "auth/email-already-exists") {
    throw new HttpsError("already-exists", "That email already has an account.");
  }
  if (code === "auth/invalid-password") {
    throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
  }
  if (code === "auth/user-not-found") {
    throw new HttpsError("not-found", "That account no longer exists.");
  }
  throw err;
}

/** Best-effort: a deleted uid's subcollection docs are unreachable, but don't leave litter. */
async function deleteSubcollections(uid: string) {
  const db = getFirestore();
  for (const name of ["notifications", "fcmTokens"]) {
    try {
      const snap = await db.collection("users").doc(uid).collection(name).limit(500).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    } catch (err) {
      console.error(`adminManageUser: failed clearing ${name} for ${uid}`, err);
    }
  }
}

/**
 * Admin-only account management. The Vercel web tier never holds the Admin SDK (ADR-0004),
 * so creating an Auth account, setting a custom claim, and hard-deleting a user all land
 * here, behind an admin-claim check that runs before any write.
 */
export const adminManageUser = onCall(async (request) => {
  const callerUid = assertAdmin(request);

  const parsed = payloadSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    throw new HttpsError("invalid-argument", "Check the highlighted fields.", { fieldErrors });
  }
  const data = parsed.data;

  if (data.action === "delete") {
    if (data.uid === callerUid) {
      throw new HttpsError("failed-precondition", "You cannot delete your own account.");
    }
    try {
      await getAuth().deleteUser(data.uid);
    } catch (err) {
      rethrowAuthError(err);
    }
    await deleteSubcollections(data.uid);
    await getFirestore().collection("users").doc(data.uid).delete();
    return { uid: data.uid, deleted: true };
  }

  const profile = profileForRole(data, data.uiRole);

  if (data.action === "create") {
    let uid: string;
    try {
      const user = await getAuth().createUser({
        email: profile.email,
        password: data.password,
        displayName: profile.displayName,
      });
      uid = user.uid;
    } catch (err) {
      rethrowAuthError(err);
    }

    await writeRole(uid!, profile.role, {
      ...profile,
      uid: uid!,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { uid: uid!, uiRole: data.uiRole };
  }

  // update
  try {
    await getAuth().updateUser(data.uid, {
      email: profile.email,
      displayName: profile.displayName,
      ...(data.password ? { password: data.password } : {}),
    });
  } catch (err) {
    rethrowAuthError(err);
  }

  await writeRole(data.uid, profile.role, profile);
  return { uid: data.uid, uiRole: data.uiRole };
});

// Later user stories add: notification fan-out (US-06) and the resolved->closed
// auto-close scheduler (ADR-0002 / workflow US-05).
