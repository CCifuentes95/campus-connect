import "server-only";

// Reads for the Appointments list + detail (US-04), scoped to studentId == uid via
// FirebaseServerApp so firestore.rules apply. Timestamps → epoch millis for serializable rows.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  type Firestore,
} from "firebase/firestore";
import { cache } from "react";
import type { LoadResult } from "@/lib/data/student-dashboard";
import { getFirestoreForUser } from "@/lib/firebase/firestore";

export interface ListAppointment {
  id: string;
  code: string;
  service: string;
  title: string;
  advisorName: string;
  startMs: number;
  endMs: number | null;
  mode: string;
  location: string;
  status: string;
}

export interface DetailAppointment extends ListAppointment {
  studentName: string;
  advisorId: string;
  notes: string;
}

const LIST_LIMIT = 100;

function toMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** All of the signed-in student's appointments, soonest first. */
export const getStudentAppointments = cache(
  async (): Promise<LoadResult<ListAppointment>> => {
    const { db, currentUser } = await getFirestoreForUser();
    if (!currentUser) return { items: [], error: false };
    try {
      const snap = await getDocs(
        query(
          collection(db as Firestore, "appointments"),
          where("studentId", "==", currentUser.uid),
          orderBy("start", "asc"),
          limit(LIST_LIMIT),
        ),
      );
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          code: str(data.code),
          service: str(data.service),
          title: str(data.title),
          advisorName: str(data.advisorName),
          startMs: toMillis(data.start) ?? 0,
          endMs: toMillis(data.end),
          mode: str(data.mode),
          location: str(data.location),
          status: str(data.status),
        } satisfies ListAppointment;
      });
      return { items, error: false };
    } catch (err) {
      console.error("[appointments] getStudentAppointments failed", err);
      return { items: [], error: true };
    }
  },
);

/** One appointment the signed-in student owns; null when missing/not theirs/failed. */
export const getAppointment = cache(
  async (id: string): Promise<DetailAppointment | null> => {
    const { db, currentUser } = await getFirestoreForUser();
    if (!currentUser) return null;
    try {
      const snap = await getDoc(doc(db as Firestore, "appointments", id));
      if (!snap.exists()) return null;
      const data = snap.data();
      if (data.studentId !== currentUser.uid) return null;
      return {
        id: snap.id,
        code: str(data.code),
        service: str(data.service),
        title: str(data.title),
        studentName: str(data.studentName),
        advisorId: str(data.advisorId),
        advisorName: str(data.advisorName),
        startMs: toMillis(data.start) ?? 0,
        endMs: toMillis(data.end),
        mode: str(data.mode),
        location: str(data.location),
        status: str(data.status),
        notes: str(data.notes),
      } satisfies DetailAppointment;
    } catch (err) {
      console.error("[appointments] getAppointment failed", err);
      return null;
    }
  },
);
