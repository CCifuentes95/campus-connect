"use server";

// US-07 staff ticket mutations: claim/assign/reassign/unassign, request-info, reply, internal
// note, mark-resolved, close, and triage-field edits. Same shape as lib/actions/tickets.ts —
// zod at the boundary, FirebaseServerApp under the signed-in staff member so firestore.rules
// apply (staff may update any ticket + author any event visibility; no Admin SDK, ADR-0004).
// Named transitions are plain { from: [...] } maps; each writes an events audit doc AFTER the
// ticket update (the events create rule get()s the parent — it can't see a same-batch write,
// the US-03 gotcha). Student notifications are best-effort (swallow + log) so a notify failure
// never fails the transition.
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getFirestoreForUser } from "@/lib/firebase/firestore";
import { getSessionUser } from "@/lib/firebase/session";
import { isEnabled } from "@/lib/flags";
import { CATEGORY_VALUES, PRIORITY_VALUES } from "@/lib/labels";
import { notifyStudent } from "@/lib/notify";

export type StaffActionResult =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

// Valid `from` statuses for each status-changing transition.
const CLAIM_FROM = ["new"] as const;
const REQUEST_INFO_FROM = ["assigned", "waiting_for_student"] as const;
const REPLY_FROM = ["assigned", "waiting_for_student"] as const;
const RESOLVE_FROM = ["assigned", "waiting_for_student"] as const;
const CLOSE_FROM = ["resolved"] as const;

/** Shared setup: the Firestore handle, the acting staff member, and the ticket snapshot.
 * Returns an error result the caller can early-return, or the loaded context. */
async function loadStaffTicket(ticketId: string): Promise<
  | { ok: false; result: StaffActionResult }
  | {
      ok: true;
      store: Firestore;
      actorId: string;
      actorName: string;
      actorRole: string;
      ref: ReturnType<typeof doc>;
      data: Record<string, unknown>;
    }
> {
  // Feature-flag gate for the whole staff ticket surface (defence-in-depth behind the route
  // gate) — every staff ticket action funnels through here.
  if (!isEnabled("staff-triage")) {
    return { ok: false, result: { status: "error", message: "Staff triage is currently unavailable." } };
  }
  if (!ticketId) {
    return { ok: false, result: { status: "error", message: "Missing ticket reference." } };
  }
  const session = await getSessionUser();
  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser || !session) {
    return {
      ok: false,
      result: { status: "error", message: "Your session has expired — please sign in again." },
    };
  }
  const store = db as Firestore;
  const ref = doc(store, "tickets", ticketId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { ok: false, result: { status: "error", message: "We couldn't find that request." } };
    }
    return {
      ok: true,
      store,
      actorId: currentUser.uid,
      actorName: currentUser.email ?? "Staff",
      actorRole: session.role,
      ref,
      data: snap.data() as Record<string, unknown>,
    };
  } catch (err) {
    console.error("[staff-tickets] load failed", err);
    return { ok: false, result: { status: "error", message: "Something went wrong — please try again." } };
  }
}

/** Append an events audit doc. Best-effort for pure transitions; the caller decides whether a
 * failure is fatal (a reply/note treats its event as primary). */
async function writeEvent(
  ref: ReturnType<typeof doc>,
  event: {
    type: string;
    visibility: "public" | "internal";
    fromStatus: string | null;
    toStatus: string | null;
    actorId: string;
    actorName: string;
    actorRole: string;
    message: string;
  },
): Promise<boolean> {
  try {
    await addDoc(collection(ref, "events"), { ...event, createdAt: serverTimestamp() });
    return true;
  } catch (err) {
    console.error("[staff-tickets] event write failed", err);
    return false;
  }
}

function revalidateTicket(ticketId: string, studentId: string) {
  revalidatePath("/staff/triage");
  revalidatePath(`/staff/requests/${ticketId}`);
  // The student's own views of the same ticket.
  revalidatePath(`/requests/${ticketId}`);
  void studentId;
}

// ---- Assignment -----------------------------------------------------------

/** Claim a NEW ticket: new → assigned, assignee = the acting staff member. */
export async function claimTicket(
  _prev: StaffActionResult,
  formData: FormData,
): Promise<StaffActionResult> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const ctx = await loadStaffTicket(ticketId);
  if (!ctx.ok) return ctx.result;
  const currentStatus = String(ctx.data.status ?? "");
  if (!(CLAIM_FROM as readonly string[]).includes(currentStatus)) {
    return { status: "error", message: "This request can't be claimed." };
  }
  try {
    await updateDoc(ctx.ref, {
      status: "assigned",
      assigneeId: ctx.actorId,
      assigneeName: ctx.actorName,
      updatedAt: serverTimestamp(),
      lastActorName: ctx.actorName,
    });
  } catch (err) {
    console.error("[staff-tickets] claim failed", err);
    return { status: "error", message: "Couldn't claim the request — please try again." };
  }
  await writeEvent(ctx.ref, {
    type: "claimed",
    visibility: "public",
    fromStatus: currentStatus,
    toStatus: "assigned",
    actorId: ctx.actorId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    message: "",
  });
  await notifyStudent({
    db: ctx.store,
    uid: String(ctx.data.studentId ?? ""),
    type: "ticket_update",
    title: "Your request is being worked on",
    body: `${String(ctx.data.code ?? "Your request")} was assigned to ${ctx.actorName}.`,
    link: `/requests/${ticketId}`,
    refId: ticketId,
  });
  revalidateTicket(ticketId, String(ctx.data.studentId ?? ""));
  return { status: "success" };
}

const AssignSchema = z.object({
  ticketId: z.string().min(1),
  assigneeId: z.string().min(1),
  assigneeName: z.string().min(1),
});

/** Assign or reassign a ticket to a chosen staff member (assignment only — status unchanged). */
export async function assignTicket(
  _prev: StaffActionResult,
  formData: FormData,
): Promise<StaffActionResult> {
  const parsed = AssignSchema.safeParse({
    ticketId: String(formData.get("ticketId") ?? ""),
    assigneeId: String(formData.get("assigneeId") ?? ""),
    assigneeName: String(formData.get("assigneeName") ?? ""),
  });
  if (!parsed.success) return { status: "error", message: "Choose someone to assign." };
  const ctx = await loadStaffTicket(parsed.data.ticketId);
  if (!ctx.ok) return ctx.result;
  const currentStatus = String(ctx.data.status ?? "");
  const wasUnassigned = ctx.data.assigneeId == null;
  try {
    await updateDoc(ctx.ref, {
      // A brand-new ticket assigned to someone moves into the working lane.
      status: currentStatus === "new" ? "assigned" : currentStatus,
      assigneeId: parsed.data.assigneeId,
      assigneeName: parsed.data.assigneeName,
      updatedAt: serverTimestamp(),
      lastActorName: ctx.actorName,
    });
  } catch (err) {
    console.error("[staff-tickets] assign failed", err);
    return { status: "error", message: "Couldn't assign the request — please try again." };
  }
  await writeEvent(ctx.ref, {
    type: "reassigned",
    visibility: "public",
    fromStatus: currentStatus,
    toStatus: currentStatus === "new" ? "assigned" : currentStatus,
    actorId: ctx.actorId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    message: `${wasUnassigned ? "Assigned" : "Reassigned"} to ${parsed.data.assigneeName}`,
  });
  revalidateTicket(parsed.data.ticketId, String(ctx.data.studentId ?? ""));
  return { status: "success" };
}

/** Clear a ticket's assignee (back toward triage). Status is left as-is. */
export async function unassignTicket(
  _prev: StaffActionResult,
  formData: FormData,
): Promise<StaffActionResult> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const ctx = await loadStaffTicket(ticketId);
  if (!ctx.ok) return ctx.result;
  const currentStatus = String(ctx.data.status ?? "");
  try {
    await updateDoc(ctx.ref, {
      assigneeId: null,
      assigneeName: null,
      updatedAt: serverTimestamp(),
      lastActorName: ctx.actorName,
    });
  } catch (err) {
    console.error("[staff-tickets] unassign failed", err);
    return { status: "error", message: "Couldn't unassign the request — please try again." };
  }
  await writeEvent(ctx.ref, {
    type: "reassigned",
    visibility: "public",
    fromStatus: currentStatus,
    toStatus: currentStatus,
    actorId: ctx.actorId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    message: "Unassigned",
  });
  revalidateTicket(ticketId, String(ctx.data.studentId ?? ""));
  return { status: "success" };
}

// ---- Conversation ---------------------------------------------------------

const MessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Write a message before sending.")
    .max(2000, "Please keep it under 2000 characters."),
});

/** Reply to the student: public message event + status → waiting_for_student, notify. */
export async function replyToStudentAsStaff(
  _prev: StaffActionResult,
  formData: FormData,
): Promise<StaffActionResult> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const parsed = MessageSchema.safeParse({ message: String(formData.get("message") ?? "") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.flatten().fieldErrors.message?.[0] ?? "Write a message." };
  }
  const ctx = await loadStaffTicket(ticketId);
  if (!ctx.ok) return ctx.result;
  const currentStatus = String(ctx.data.status ?? "");
  if (!(REPLY_FROM as readonly string[]).includes(currentStatus)) {
    return { status: "error", message: "Claim the request before replying." };
  }
  try {
    await updateDoc(ctx.ref, {
      status: "waiting_for_student",
      updatedAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastActorName: ctx.actorName,
    });
  } catch (err) {
    console.error("[staff-tickets] reply status update failed", err);
    return { status: "error", message: "Your reply didn't send — please try again." };
  }
  const wrote = await writeEvent(ctx.ref, {
    type: "message",
    visibility: "public",
    fromStatus: currentStatus,
    toStatus: "waiting_for_student",
    actorId: ctx.actorId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    message: parsed.data.message,
  });
  if (!wrote) return { status: "error", message: "Your reply didn't post — please try again." };
  await notifyStudent({
    db: ctx.store,
    uid: String(ctx.data.studentId ?? ""),
    type: "ticket_reply",
    title: "New reply on your request",
    body: `${ctx.actorName} replied on ${String(ctx.data.code ?? "your request")}.`,
    link: `/requests/${ticketId}`,
    refId: ticketId,
  });
  revalidateTicket(ticketId, String(ctx.data.studentId ?? ""));
  return { status: "success" };
}

/** Request info from the student: assigned → waiting_for_student with a public prompt, notify. */
export async function requestInfo(
  _prev: StaffActionResult,
  formData: FormData,
): Promise<StaffActionResult> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const parsed = MessageSchema.safeParse({ message: String(formData.get("message") ?? "") });
  if (!parsed.success) {
    return { status: "error", message: "Add a note telling the student what you need." };
  }
  const ctx = await loadStaffTicket(ticketId);
  if (!ctx.ok) return ctx.result;
  const currentStatus = String(ctx.data.status ?? "");
  if (!(REQUEST_INFO_FROM as readonly string[]).includes(currentStatus)) {
    return { status: "error", message: "Claim the request before requesting info." };
  }
  try {
    await updateDoc(ctx.ref, {
      status: "waiting_for_student",
      updatedAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastActorName: ctx.actorName,
    });
  } catch (err) {
    console.error("[staff-tickets] requestInfo update failed", err);
    return { status: "error", message: "Something went wrong — please try again." };
  }
  const wrote = await writeEvent(ctx.ref, {
    type: "info_requested",
    visibility: "public",
    fromStatus: currentStatus,
    toStatus: "waiting_for_student",
    actorId: ctx.actorId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    message: parsed.data.message,
  });
  if (!wrote) return { status: "error", message: "That didn't post — please try again." };
  await notifyStudent({
    db: ctx.store,
    uid: String(ctx.data.studentId ?? ""),
    type: "ticket_update",
    title: "More information needed",
    body: `${ctx.actorName} needs more info on ${String(ctx.data.code ?? "your request")}.`,
    link: `/requests/${ticketId}`,
    refId: ticketId,
  });
  revalidateTicket(ticketId, String(ctx.data.studentId ?? ""));
  return { status: "success" };
}

/** Add a staff-only internal note (visibility internal). No status change, no notification. */
export async function addInternalNote(
  _prev: StaffActionResult,
  formData: FormData,
): Promise<StaffActionResult> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const parsed = MessageSchema.safeParse({ message: String(formData.get("message") ?? "") });
  if (!parsed.success) {
    return { status: "error", message: "Write the note before saving." };
  }
  const ctx = await loadStaffTicket(ticketId);
  if (!ctx.ok) return ctx.result;
  const currentStatus = String(ctx.data.status ?? "");
  const wrote = await writeEvent(ctx.ref, {
    type: "internal_note",
    visibility: "internal",
    fromStatus: null,
    toStatus: null,
    actorId: ctx.actorId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    message: parsed.data.message,
  });
  if (!wrote) return { status: "error", message: "The note didn't save — please try again." };
  // Bump updatedAt/lastActor so the board reflects recent activity (status untouched).
  try {
    await updateDoc(ctx.ref, { updatedAt: serverTimestamp(), lastActorName: ctx.actorName });
  } catch (err) {
    console.error("[staff-tickets] internal note bump failed", err);
  }
  void currentStatus;
  revalidateTicket(ticketId, String(ctx.data.studentId ?? ""));
  return { status: "success" };
}

// ---- Status close-out -----------------------------------------------------

/** Mark resolved: assigned/waiting → resolved, set resolvedAt, notify. */
export async function markResolved(
  _prev: StaffActionResult,
  formData: FormData,
): Promise<StaffActionResult> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const ctx = await loadStaffTicket(ticketId);
  if (!ctx.ok) return ctx.result;
  const currentStatus = String(ctx.data.status ?? "");
  if (!(RESOLVE_FROM as readonly string[]).includes(currentStatus)) {
    return { status: "error", message: "Only an in-progress request can be resolved." };
  }
  try {
    await updateDoc(ctx.ref, {
      status: "resolved",
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActorName: ctx.actorName,
    });
  } catch (err) {
    console.error("[staff-tickets] markResolved failed", err);
    return { status: "error", message: "Couldn't resolve the request — please try again." };
  }
  await writeEvent(ctx.ref, {
    type: "resolved",
    visibility: "public",
    fromStatus: currentStatus,
    toStatus: "resolved",
    actorId: ctx.actorId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    message: "",
  });
  await notifyStudent({
    db: ctx.store,
    uid: String(ctx.data.studentId ?? ""),
    type: "ticket_update",
    title: "Your request was resolved",
    body: `${String(ctx.data.code ?? "Your request")} was marked resolved. Reopen it if you still need help.`,
    link: `/requests/${ticketId}`,
    refId: ticketId,
  });
  revalidateTicket(ticketId, String(ctx.data.studentId ?? ""));
  return { status: "success" };
}

/** Close a resolved ticket (terminal). No student notification. */
export async function closeTicket(
  _prev: StaffActionResult,
  formData: FormData,
): Promise<StaffActionResult> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const ctx = await loadStaffTicket(ticketId);
  if (!ctx.ok) return ctx.result;
  const currentStatus = String(ctx.data.status ?? "");
  if (!(CLOSE_FROM as readonly string[]).includes(currentStatus)) {
    return { status: "error", message: "Only a resolved request can be closed." };
  }
  try {
    await updateDoc(ctx.ref, {
      status: "closed",
      updatedAt: serverTimestamp(),
      lastActorName: ctx.actorName,
    });
  } catch (err) {
    console.error("[staff-tickets] closeTicket failed", err);
    return { status: "error", message: "Couldn't close the request — please try again." };
  }
  await writeEvent(ctx.ref, {
    type: "closed",
    visibility: "public",
    fromStatus: currentStatus,
    toStatus: "closed",
    actorId: ctx.actorId,
    actorName: ctx.actorName,
    actorRole: ctx.actorRole,
    message: "",
  });
  revalidateTicket(ticketId, String(ctx.data.studentId ?? ""));
  return { status: "success" };
}

// ---- Triage fields (priority / category / next action) --------------------

const TriageFieldsSchema = z.object({
  ticketId: z.string().min(1),
  priority: z.enum(PRIORITY_VALUES),
  category: z.enum(CATEGORY_VALUES),
  nextAction: z.string().trim().max(140, "Keep the next action under 140 characters."),
});

/** Edit priority / category / next action. Never touches status, studentId, or assignee. */
export async function updateTriageFields(
  _prev: StaffActionResult,
  formData: FormData,
): Promise<StaffActionResult> {
  const parsed = TriageFieldsSchema.safeParse({
    ticketId: String(formData.get("ticketId") ?? ""),
    priority: String(formData.get("priority") ?? ""),
    category: String(formData.get("category") ?? ""),
    nextAction: String(formData.get("nextAction") ?? ""),
  });
  if (!parsed.success) {
    return { status: "error", message: "Check the priority, category, and next action." };
  }
  const ctx = await loadStaffTicket(parsed.data.ticketId);
  if (!ctx.ok) return ctx.result;
  try {
    await updateDoc(ctx.ref, {
      priority: parsed.data.priority,
      category: parsed.data.category,
      nextAction: parsed.data.nextAction || null,
      updatedAt: serverTimestamp(),
      lastActorName: ctx.actorName,
    });
  } catch (err) {
    console.error("[staff-tickets] updateTriageFields failed", err);
    return { status: "error", message: "Couldn't save — please try again." };
  }
  revalidateTicket(parsed.data.ticketId, String(ctx.data.studentId ?? ""));
  return { status: "success" };
}
