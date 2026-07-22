"use server";

// The app's first mutation: create a support ticket. Writes run through FirebaseServerApp
// under the signed-in user's ID token, so firestore.rules apply (never the Admin SDK on the
// web tier — ADR-0004). Input is validated with zod at the boundary before any write.
import {
  addDoc,
  collection,
  doc,
  type Firestore,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudentProfile } from "@/lib/data/student-dashboard";
import { getFirestoreForUser } from "@/lib/firebase/firestore";
import { CATEGORY_VALUES, PRIORITY_VALUES } from "@/lib/labels";
import { notifyStudent } from "@/lib/notify";

const CreateTicketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Please enter a short title for your request.")
    .max(120, "Please keep the title under 120 characters."),
  category: z.enum(CATEGORY_VALUES),
  priority: z.enum(PRIORITY_VALUES).catch("medium"),
  description: z
    .string()
    .trim()
    .min(1, "Add a few details so we can help.")
    .max(1000, "Please keep your description under 1000 characters."),
});

type FieldName = "title" | "category" | "description";

/** Values echoed back to the form so a validation error doesn't wipe the student's input. */
export interface TicketFormValues {
  title: string;
  category: string;
  priority: string;
  description: string;
}

export type CreateTicketState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors: Partial<Record<FieldName, string>>;
      values: TicketFormValues;
    }
  | { status: "success"; id: string; code: string };

/** Human-facing reference code derived from the ticket's own doc id (unique, no counter). */
function referenceCode(id: string): string {
  return `REQ-${id.slice(-6).toUpperCase()}`;
}

export async function createTicket(
  _prev: CreateTicketState,
  formData: FormData,
): Promise<CreateTicketState> {
  const values: TicketFormValues = {
    title: String(formData.get("title") ?? ""),
    category: String(formData.get("category") ?? ""),
    priority: String(formData.get("priority") ?? "medium"),
    description: String(formData.get("description") ?? ""),
  };

  const parsed = CreateTicketSchema.safeParse(values);
  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors;
    const fieldErrors: Partial<Record<FieldName, string>> = {};
    if (fe.title?.[0]) fieldErrors.title = fe.title[0];
    if (fe.category) fieldErrors.category = "Choose the area that best fits.";
    if (fe.description?.[0]) fieldErrors.description = fe.description[0];
    return {
      status: "error",
      message: "Please complete the required fields",
      fieldErrors,
      values,
    };
  }

  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser) {
    return {
      status: "error",
      message: "Your session has expired — please sign in again.",
      fieldErrors: {},
      values,
    };
  }

  // Denormalize the student's display name onto the ticket (Firestore has no joins).
  const profile = await getStudentProfile();
  const studentName =
    profile?.displayName ?? profile?.email ?? currentUser.email ?? "Student";

  const { title, category, priority, description } = parsed.data;
  const store = db as Firestore;

  // Pre-generate the ref so the code can be derived from its id and written in the same doc.
  const ticketRef = doc(collection(store, "tickets"));
  const code = referenceCode(ticketRef.id);

  await setDoc(ticketRef, {
    code,
    title,
    description,
    category,
    priority,
    status: "new",
    studentId: currentUser.uid,
    studentName,
    assigneeId: null,
    assigneeName: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActorName: studentName,
    lastMessageAt: serverTimestamp(),
    resolvedAt: null,
    nextAction: null,
    rating: null,
  });

  // Best-effort audit row. Written second (not batched) because the events create rule reads
  // the parent ticket via get(), which can't see a same-batch create. A failure here must not
  // fail the submission — the ticket the student cares about already exists.
  try {
    await addDoc(collection(ticketRef, "events"), {
      type: "created",
      visibility: "public",
      fromStatus: null,
      toStatus: "new",
      actorId: currentUser.uid,
      actorName: studentName,
      actorRole: "student",
      message: "",
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("[tickets] created-event write failed", err);
  }

  // Refresh the list + dashboard so the new request shows on next navigation.
  revalidatePath("/requests");
  revalidatePath("/");

  return { status: "success", id: ticketRef.id, code };
}

// ---------------------------------------------------------------------------
// US-05 — Track Ticket: student write actions (reply, reopen).
//
// Both land the ticket on `assigned`, which the existing `tickets` update rule permits for the
// owning student (result status ∈ {assigned, waiting_for_student}, studentId/assigneeId
// unchanged) — so no firestore.rules change is needed. Named transitions live in plain
// `{ from: [...] }` maps, not a state-machine library (project convention).
// ---------------------------------------------------------------------------

/** Reply moves a *waiting* ticket back to the staff queue; a comment on an already-in-progress
 * ticket is event-only. Any other status is not a valid reply source. */
const REPLY_FROM = ["assigned", "waiting_for_student"] as const;
/** Reopen returns a done ticket to the staff queue. */
const REOPEN_FROM = ["resolved", "closed"] as const;

const ReplySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Write a message before posting.")
    .max(1000, "Please keep your reply under 1000 characters."),
});

export type ReplyState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export type ReopenState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

/**
 * Post a public `student_reply` on a ticket. The event is the primary artifact (its failure is a
 * real error, unlike US-03's best-effort `created` marker). Then, guarded by REPLY_FROM, bump the
 * ticket: `waiting_for_student → assigned`; an `assigned` ticket stays assigned (updatedAt moves);
 * a `new` ticket is left untouched (the rule forbids a student update that keeps status `new`, and
 * we don't want a student comment to self-assign triage) — the event still posts.
 */
export async function replyToTicket(
  _prev: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const parsed = ReplySchema.safeParse({
    message: String(formData.get("message") ?? ""),
  });
  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors;
    return { status: "error", message: fe.message?.[0] ?? "Write a message before posting." };
  }
  if (!ticketId) return { status: "error", message: "Missing ticket reference." };

  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser) {
    return { status: "error", message: "Your session has expired — please sign in again." };
  }
  const store = db as Firestore;
  const ticketRef = doc(store, "tickets", ticketId);

  let currentStatus: string;
  let ticketCode: string;
  try {
    const snap = await getDoc(ticketRef);
    if (!snap.exists() || snap.data().studentId !== currentUser.uid) {
      return { status: "error", message: "We couldn't find that request." };
    }
    currentStatus = String(snap.data().status ?? "");
    ticketCode = String(snap.data().code ?? "");
  } catch (err) {
    console.error("[tickets] replyToTicket read failed", err);
    return { status: "error", message: "Something went wrong — please try again." };
  }

  const profile = await getStudentProfile();
  const studentName =
    profile?.displayName ?? profile?.email ?? currentUser.email ?? "Student";

  // Event first (its create rule get()s the parent, which can't see a same-batch write).
  try {
    await addDoc(collection(ticketRef, "events"), {
      type: "student_reply",
      visibility: "public",
      fromStatus: currentStatus,
      toStatus: currentStatus === "waiting_for_student" ? "assigned" : currentStatus,
      actorId: currentUser.uid,
      actorName: studentName,
      actorRole: "student",
      message: parsed.data.message,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("[tickets] student_reply write failed", err);
    return { status: "error", message: "Your reply didn't post — please try again." };
  }

  // Ticket bump: only for statuses whose result stays rules-valid (assigned / waiting→assigned).
  // A `new` ticket is left as-is (see doc comment above).
  if ((REPLY_FROM as readonly string[]).includes(currentStatus)) {
    try {
      await updateDoc(ticketRef, {
        status: "assigned",
        updatedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        lastActorName: studentName,
      });
    } catch (err) {
      // The reply (the thing the student cares about) already posted; a failed status bump
      // shouldn't read as "reply failed". Log and report success.
      console.error("[tickets] reply status bump failed", err);
    }
  }

  await notifyStudent({
    db: store,
    uid: currentUser.uid,
    type: "ticket_reply",
    title: "Reply posted",
    body: `Your reply on ${ticketCode} was posted.`,
    link: `/requests/${ticketId}`,
    refId: ticketId,
  });

  revalidatePath(`/requests/${ticketId}`);
  revalidatePath("/requests");
  revalidatePath("/");
  return { status: "success" };
}

/**
 * Reopen a resolved/closed ticket → `assigned`, as a plain field update (status + updatedAt),
 * guarded by REOPEN_FROM. No audit event is written (deliberate deviation from tickets'
 * "event per transition" — recorded in the change); studentId/assigneeId are untouched.
 */
export async function reopenTicket(
  _prev: ReopenState,
  formData: FormData,
): Promise<ReopenState> {
  const ticketId = String(formData.get("ticketId") ?? "");
  if (!ticketId) return { status: "error", message: "Missing ticket reference." };

  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser) {
    return { status: "error", message: "Your session has expired — please sign in again." };
  }
  const store = db as Firestore;
  const ticketRef = doc(store, "tickets", ticketId);

  try {
    const snap = await getDoc(ticketRef);
    if (!snap.exists() || snap.data().studentId !== currentUser.uid) {
      return { status: "error", message: "We couldn't find that request." };
    }
    const currentStatus = String(snap.data().status ?? "");
    const ticketCode = String(snap.data().code ?? "");
    if (!(REOPEN_FROM as readonly string[]).includes(currentStatus)) {
      return { status: "error", message: "This request can't be reopened." };
    }
    await updateDoc(ticketRef, {
      status: "assigned",
      updatedAt: serverTimestamp(),
    });
    await notifyStudent({
      db: store,
      uid: currentUser.uid,
      type: "ticket_update",
      title: "Request reopened",
      body: `You reopened ${ticketCode}.`,
      link: `/requests/${ticketId}`,
      refId: ticketId,
    });
  } catch (err) {
    console.error("[tickets] reopenTicket failed", err);
    return { status: "error", message: "Something went wrong — please try again." };
  }

  revalidatePath(`/requests/${ticketId}`);
  revalidatePath("/requests");
  revalidatePath("/");
  return { status: "success" };
}
