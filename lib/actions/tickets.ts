"use server";

// The app's first mutation: create a support ticket. Writes run through FirebaseServerApp
// under the signed-in user's ID token, so firestore.rules apply (never the Admin SDK on the
// web tier — ADR-0004). Input is validated with zod at the boundary before any write.
import {
  addDoc,
  collection,
  doc,
  type Firestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudentProfile } from "@/lib/data/student-dashboard";
import { getFirestoreForUser } from "@/lib/firebase/firestore";
import { CATEGORY_VALUES, PRIORITY_VALUES } from "@/lib/labels";

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
