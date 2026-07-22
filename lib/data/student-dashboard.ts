import "server-only";

// Read helpers for the student dashboard (US-02). All reads run through
// getFirestoreForUser() so firestore.rules enforce access under the signed-in user; every
// query is scoped to `studentId == uid`. Firestore Timestamps are converted to epoch millis
// so the values are plain/serializable for the (server-rendered) card components.
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
import { getFirestoreForUser } from "@/lib/firebase/firestore";

// How many docs to pull. Tickets: fetch a wider window than we render so the "open" badge
// counts real open requests (derive-from-fetch — see design.md). Appointments: a small cap.
const TICKET_FETCH_LIMIT = 25;
const APPOINTMENT_FETCH_LIMIT = 10;

export interface DashboardTicket {
  id: string;
  code: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  updatedAtMs: number | null;
}

export interface DashboardAppointment {
  id: string;
  service: string;
  title: string;
  advisorName: string;
  startMs: number;
  mode: string;
}

export interface StudentProfile {
  displayName: string | null;
  initials: string | null;
  email: string | null;
}

/**
 * A list load that can distinguish a genuine empty result from a failed read, so the UI
 * never renders a query error as a legitimately empty lane (see spec + design.md).
 */
export interface LoadResult<T> {
  items: T[];
  error: boolean;
}

function toMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  return null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The signed-in student's most recently updated tickets (scoped to studentId == uid). */
export const getRecentTickets = cache(
  async (): Promise<LoadResult<DashboardTicket>> => {
    const { db, currentUser } = await getFirestoreForUser();
    if (!currentUser) return { items: [], error: false };

    try {
      const snap = await getDocs(
        query(
          collection(db as Firestore, "tickets"),
          where("studentId", "==", currentUser.uid),
          orderBy("updatedAt", "desc"),
          limit(TICKET_FETCH_LIMIT),
        ),
      );
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          code: str(data.code),
          title: str(data.title),
          category: str(data.category),
          priority: str(data.priority),
          status: str(data.status),
          updatedAtMs: toMillis(data.updatedAt),
        } satisfies DashboardTicket;
      });
      return { items, error: false };
    } catch (err) {
      console.error("[student-dashboard] getRecentTickets failed", err);
      return { items: [], error: true };
    }
  },
);

/** The signed-in student's upcoming appointments (start >= now, soonest first). */
export const getUpcomingAppointments = cache(
  async (): Promise<LoadResult<DashboardAppointment>> => {
    const { db, currentUser } = await getFirestoreForUser();
    if (!currentUser) return { items: [], error: false };

    try {
      const snap = await getDocs(
        query(
          collection(db as Firestore, "appointments"),
          where("studentId", "==", currentUser.uid),
          where("start", ">=", Timestamp.now()),
          orderBy("start", "asc"),
          limit(APPOINTMENT_FETCH_LIMIT),
        ),
      );
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          service: str(data.service),
          title: str(data.title),
          advisorName: str(data.advisorName),
          startMs: toMillis(data.start) ?? 0,
          mode: str(data.mode),
        } satisfies DashboardAppointment;
      });
      return { items, error: false };
    } catch (err) {
      console.error("[student-dashboard] getUpcomingAppointments failed", err);
      return { items: [], error: true };
    }
  },
);

/**
 * The signed-in student's own users/{uid} profile for the greeting + nav identity. Returns
 * null when there is no session, no profile doc, or the read fails — callers fall back to the
 * email / a generic greeting rather than erroring (profiles are function-created, and the MVP
 * runs no Cloud Functions, so the doc may not exist).
 */
export const getStudentProfile = cache(
  async (): Promise<StudentProfile | null> => {
    const { db, currentUser } = await getFirestoreForUser();
    if (!currentUser) return null;

    try {
      const snap = await getDoc(doc(db as Firestore, "users", currentUser.uid));
      if (!snap.exists()) {
        return { displayName: null, initials: null, email: currentUser.email };
      }
      const data = snap.data();
      return {
        displayName: str(data.displayName) || null,
        initials: str(data.initials) || null,
        email: str(data.email) || currentUser.email,
      };
    } catch (err) {
      console.error("[student-dashboard] getStudentProfile failed", err);
      return null;
    }
  },
);
