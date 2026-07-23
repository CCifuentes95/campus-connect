"use server";

// US-04 booking mutations — the second write, reusing the US-03 pattern (zod at the boundary,
// FirebaseServerApp under the user so rules apply, no Admin SDK). Appointments have no `events`
// subcollection; cancel/reschedule are plain updates guarded by a { from: [...] } map.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ADVISOR_IDS,
  advisorById,
  isValidSlot,
  overlaps,
  SERVICE_VALUES,
  serviceByValue,
} from "@/lib/advising";
import { getStudentProfile } from "@/lib/data/student-dashboard";
import { getFirestoreForUser } from "@/lib/firebase/firestore";
import { isEnabled } from "@/lib/flags";
import { clockTime, timelineStamp } from "@/lib/format";
import { serviceLabel } from "@/lib/labels";
import { notifyStudent } from "@/lib/notify";

const BookSchema = z.object({
  service: z.enum(SERVICE_VALUES),
  advisorId: z.enum(ADVISOR_IDS),
  startMs: z.coerce.number().int().positive(),
});

export type BookState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; id: string; code: string };

export type ActionResult =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

function apptCode(id: string): string {
  return `APT-${id.slice(-6).toUpperCase()}`;
}

interface Span {
  id: string;
  startMs: number;
  endMs: number;
  service: string;
  advisorName: string;
}

/** The signed-in student's booked appointments as spans (for conflict checks). */
async function bookedSpans(db: Firestore, uid: string): Promise<Span[]> {
  const snap = await getDocs(
    query(collection(db, "appointments"), where("studentId", "==", uid)),
  );
  return snap.docs
    .map((d) => {
      const data = d.data();
      const start = data.start instanceof Timestamp ? data.start.toMillis() : 0;
      const end = data.end instanceof Timestamp ? data.end.toMillis() : 0;
      return {
        id: d.id,
        startMs: start,
        endMs: end,
        service: typeof data.service === "string" ? data.service : "",
        advisorName: typeof data.advisorName === "string" ? data.advisorName : "",
        status: typeof data.status === "string" ? data.status : "",
      };
    })
    .filter((a) => a.status === "booked")
    .map(({ id, startMs, endMs, service, advisorName }) => ({
      id,
      startMs,
      endMs,
      service,
      advisorName,
    }));
}

function clashMessage(clash: Span): string {
  return `You already have ${serviceLabel(clash.service)} with ${clash.advisorName} at ${clockTime(clash.startMs)} that day. Pick a different slot.`;
}

export async function bookAppointment(
  _prev: BookState,
  formData: FormData,
): Promise<BookState> {
  if (!isEnabled("book-appointment")) {
    return { status: "error", message: "Booking is currently unavailable." };
  }
  const parsed = BookSchema.safeParse({
    service: formData.get("service"),
    advisorId: formData.get("advisorId"),
    startMs: formData.get("startMs"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please choose a service, advisor, and time." };
  }

  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser) {
    return { status: "error", message: "Your session has expired — please sign in again." };
  }
  const store = db as Firestore;
  const { service, advisorId, startMs } = parsed.data;

  const advisor = advisorById(advisorId);
  const svc = serviceByValue(service);
  if (!advisor || !svc) {
    return { status: "error", message: "That service or advisor is no longer available." };
  }
  const endMs = startMs + svc.durationMin * 60_000;
  const now = Date.now();

  // The slot must be a real, future, on-grid weekday slot.
  if (!isValidSlot(service, startMs, [], now)) {
    return { status: "error", message: "That time isn't available. Please pick another slot." };
  }

  // Student-side conflict check (no advisor double-booking check — seeded MVP).
  const spans = await bookedSpans(store, currentUser.uid);
  const clash = spans.find((s) => overlaps(startMs, endMs, s.startMs, s.endMs));
  if (clash) {
    return { status: "error", message: clashMessage(clash) };
  }

  const profile = await getStudentProfile();
  const studentName =
    profile?.displayName ?? profile?.email ?? currentUser.email ?? "Student";

  const ref = doc(collection(store, "appointments"));
  const code = apptCode(ref.id);
  await setDoc(ref, {
    code,
    service,
    title: serviceLabel(service),
    studentId: currentUser.uid,
    studentName,
    advisorId,
    advisorName: advisor.name,
    start: Timestamp.fromMillis(startMs),
    end: Timestamp.fromMillis(endMs),
    mode: advisor.mode,
    location: advisor.location,
    status: "booked",
    notes: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await notifyStudent({
    db: store,
    uid: currentUser.uid,
    type: "appointment_booked",
    title: "Appointment booked",
    body: `${serviceLabel(service)} with ${advisor.name} on ${timelineStamp(startMs)}.`,
    link: `/appointments/${ref.id}`,
    refId: ref.id,
  });

  revalidatePath("/appointments");
  revalidatePath("/");
  return { status: "success", id: ref.id, code };
}

/**
 * Mark a booked appointment completed (US-07 staff action). Guarded by { from: ["booked"] };
 * a plain field update (appointments have no audit subcollection). Staff may update any
 * appointment (firestore.rules `isStaff()`), so this loads by id without an ownership check.
 * studentId/advisorId are left untouched.
 */
export async function completeAppointment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!isEnabled("staff-triage")) {
    return { status: "error", message: "Staff triage is currently unavailable." };
  }
  const id = String(formData.get("id") ?? "");
  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser || !id) {
    return { status: "error", message: "Your session has expired — please sign in again." };
  }
  const store = db as Firestore;
  try {
    const snap = await getDoc(doc(store, "appointments", id));
    if (!snap.exists()) return { status: "error", message: "Appointment not found." };
    if (snap.data().status !== "booked") {
      return { status: "error", message: "Only a booked appointment can be completed." };
    }
    await updateDoc(snap.ref, { status: "completed", updatedAt: serverTimestamp() });
  } catch (err) {
    console.error("[appointments] completeAppointment failed", err);
    return { status: "error", message: "Couldn't update the appointment — please try again." };
  }
  revalidatePath("/staff/appointments");
  revalidatePath(`/staff/appointments/${id}`);
  return { status: "success" };
}

/** Load an appointment the caller owns; returns null if missing or not theirs. */
async function ownedAppointment(db: Firestore, id: string, uid: string) {
  const snap = await getDoc(doc(db, "appointments", id));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.studentId !== uid) return null;
  return { ref: snap.ref, data };
}

export async function cancelAppointment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser || !id) {
    return { status: "error", message: "Your session has expired — please sign in again." };
  }
  const store = db as Firestore;
  const appt = await ownedAppointment(store, id, currentUser.uid);
  if (!appt) return { status: "error", message: "Appointment not found." };
  if (appt.data.status !== "booked") {
    return { status: "error", message: "Only a booked appointment can be cancelled." };
  }
  await updateDoc(appt.ref, { status: "cancelled", updatedAt: serverTimestamp() });
  await notifyStudent({
    db: store,
    uid: currentUser.uid,
    type: "appointment_cancelled",
    title: "Appointment cancelled",
    body: `Your ${serviceLabel(String(appt.data.service ?? ""))} appointment was cancelled.`,
    link: `/appointments/${id}`,
    refId: id,
  });
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
  revalidatePath("/");
  return { status: "success" };
}

export async function rescheduleAppointment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const startMs = Number(formData.get("startMs"));
  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser || !id || !Number.isFinite(startMs)) {
    return { status: "error", message: "Something went wrong. Please try again." };
  }
  const store = db as Firestore;
  const appt = await ownedAppointment(store, id, currentUser.uid);
  if (!appt) return { status: "error", message: "Appointment not found." };
  if (appt.data.status !== "booked") {
    return { status: "error", message: "Only a booked appointment can be rescheduled." };
  }
  const service = typeof appt.data.service === "string" ? appt.data.service : "";
  const svc = serviceByValue(service);
  if (!svc) return { status: "error", message: "That service is no longer available." };
  const endMs = startMs + svc.durationMin * 60_000;
  const now = Date.now();

  if (!isValidSlot(service, startMs, [], now)) {
    return { status: "error", message: "That time isn't available. Please pick another slot." };
  }
  const spans = (await bookedSpans(store, currentUser.uid)).filter((s) => s.id !== id);
  const clash = spans.find((s) => overlaps(startMs, endMs, s.startMs, s.endMs));
  if (clash) return { status: "error", message: clashMessage(clash) };

  await updateDoc(appt.ref, {
    start: Timestamp.fromMillis(startMs),
    end: Timestamp.fromMillis(endMs),
    updatedAt: serverTimestamp(),
  });
  await notifyStudent({
    db: store,
    uid: currentUser.uid,
    type: "appointment_booked",
    title: "Appointment rescheduled",
    body: `${serviceLabel(service)} moved to ${timelineStamp(startMs)}.`,
    link: `/appointments/${id}`,
    refId: id,
  });
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
  revalidatePath("/");
  return { status: "success" };
}
