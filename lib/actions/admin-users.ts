"use server";

// admin-user-management (ADR-0007) — create / update / delete accounts.
//
// Creating an Auth account, setting a custom claim, and deleting a user all need the Admin
// SDK, which never runs on Vercel (ADR-0004). So these actions validate at the boundary and
// then delegate to the `adminManageUser` callable Cloud Function, which re-checks the admin
// claim before any write. The claim check inside the function is the real authorization
// boundary; the session check here is just for a better error message.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CATEGORIES, CREATABLE_UI_ROLES, UI_ROLES } from "@/lib/admin-users";
import { callAsUser } from "@/lib/firebase/functions";
import { getSessionUser } from "@/lib/firebase/session";

export type AdminUserState =
  | { status: "idle" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; uid?: string };

const EXPIRED = "Your session has expired — please sign in again.";
const FORBIDDEN = "Only admins can manage user accounts.";

const profileFields = {
  displayName: z.string().trim().min(1, "Enter the person's full name."),
  program: z.string().trim().optional(),
  cohort: z.string().trim().optional(),
  studentId: z.string().trim().optional(),
  dept: z.string().trim().optional(),
  title: z.string().trim().optional(),
  cats: z.array(z.enum(CATEGORIES)).optional(),
  bookable: z.boolean().optional(),
};

const createSchema = z.object({
  uiRole: z.enum(CREATABLE_UI_ROLES),
  email: z.email("Enter a valid university email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  ...profileFields,
});

const updateSchema = z.object({
  uid: z.string().min(1),
  uiRole: z.enum(UI_ROLES),
  email: z.email("Enter a valid university email."),
  // blank keeps the current password
  password: z
    .string()
    .refine((p) => p.length === 0 || p.length >= 8, "Password must be at least 8 characters."),
  ...profileFields,
});

/** Reads the shared profile fields off FormData. `cats` arrives as repeated entries. */
function profileFromFormData(formData: FormData) {
  return {
    displayName: String(formData.get("displayName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    uiRole: String(formData.get("uiRole") ?? ""),
    program: String(formData.get("program") ?? ""),
    cohort: String(formData.get("cohort") ?? ""),
    studentId: String(formData.get("studentId") ?? ""),
    dept: String(formData.get("dept") ?? ""),
    title: String(formData.get("title") ?? ""),
    cats: formData.getAll("cats").map(String),
    bookable: formData.get("bookable") === "on" || formData.get("bookable") === "true",
  };
}

/**
 * Maps an HttpsError from the callable onto the discriminated error shape. The function
 * attaches `fieldErrors` for zod failures; duplicate email and short password get pinned to
 * their field so the form can highlight it.
 */
function errorFromCallable(err: unknown): AdminUserState {
  const code = (err as { code?: string })?.code ?? "";
  const details = (err as { details?: { fieldErrors?: Record<string, string[]> } })?.details;

  if (details?.fieldErrors) return { status: "error", fieldErrors: details.fieldErrors };
  if (code.endsWith("already-exists")) {
    return { status: "error", fieldErrors: { email: ["That email already has an account."] } };
  }
  if (code.endsWith("permission-denied")) return { status: "error", message: FORBIDDEN };
  if (code.endsWith("failed-precondition")) {
    return { status: "error", message: "You cannot delete your own account." };
  }
  if (code.endsWith("not-found")) {
    return { status: "error", message: "That account no longer exists." };
  }
  if (code.endsWith("unauthenticated")) return { status: "error", message: EXPIRED };
  if (code.endsWith("internal") || code.endsWith("not-found")) {
    return { status: "error", message: "Couldn't reach user management — please try again." };
  }
  return { status: "error", message: "Something went wrong — please try again." };
}

/** Admin gate for the action layer. The Cloud Function re-checks; this is for the message. */
async function requireAdmin(): Promise<AdminUserState | null> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: EXPIRED };
  if (user.role !== "admin") return { status: "error", message: FORBIDDEN };
  return null;
}

function revalidate(uid?: string) {
  revalidatePath("/admin/users");
  if (uid) revalidatePath(`/admin/users/${uid}`);
}

export async function createUser(
  _prev: AdminUserState,
  formData: FormData,
): Promise<AdminUserState> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = createSchema.safeParse(profileFromFormData(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    const { result, signedIn } = await callAsUser<Record<string, unknown>, { uid: string }>(
      "adminManageUser",
      { action: "create", ...parsed.data },
    );
    if (!signedIn) return { status: "error", message: EXPIRED };
    revalidate();
    return { status: "success", uid: result?.uid };
  } catch (err) {
    console.error("[admin-users] createUser failed", err);
    return errorFromCallable(err);
  }
}

export async function updateUser(
  _prev: AdminUserState,
  formData: FormData,
): Promise<AdminUserState> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = updateSchema.safeParse({
    ...profileFromFormData(formData),
    uid: String(formData.get("uid") ?? ""),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    const { signedIn } = await callAsUser<Record<string, unknown>, { uid: string }>(
      "adminManageUser",
      { action: "update", ...parsed.data },
    );
    if (!signedIn) return { status: "error", message: EXPIRED };
    revalidate(parsed.data.uid);
    return { status: "success", uid: parsed.data.uid };
  } catch (err) {
    console.error("[admin-users] updateUser failed", err);
    return errorFromCallable(err);
  }
}

export async function deleteUser(
  _prev: AdminUserState,
  formData: FormData,
): Promise<AdminUserState> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const uid = String(formData.get("uid") ?? "");
  if (!uid) return { status: "error", message: "Missing account reference." };

  try {
    const { signedIn } = await callAsUser<Record<string, unknown>, { deleted: boolean }>(
      "adminManageUser",
      { action: "delete", uid },
    );
    if (!signedIn) return { status: "error", message: EXPIRED };
    revalidate(uid);
    return { status: "success", uid };
  } catch (err) {
    console.error("[admin-users] deleteUser failed", err);
    return errorFromCallable(err);
  }
}
