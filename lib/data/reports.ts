import "server-only";

// Admin reporting read (US-08). Admin is a superset of staff, so firestore.rules already let it
// read every ticket and appointment — one bounded fetch per collection through FirebaseServerApp
// (no Admin SDK; ADR-0004). No GROUP BY: the dashboard aggregates in memory (lib/reports.ts) and
// re-aggregates client-side as filters change (US-02/05/07 pattern). Ordered by a single field
// (createdAt / start → automatic index), so no composite index to deploy.
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import { cache } from "react";
import { getFirestoreForUser } from "@/lib/firebase/firestore";

export interface ReportTicket {
  id: string;
  code: string;
  title: string;
  status: string;
  category: string;
  priority: string;
  studentName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAtMs: number | null;
  resolvedAtMs: number | null;
  rating: number | null;
}

export interface ReportAppointment {
  id: string;
  status: string;
  service: string;
  advisorId: string;
  advisorName: string;
  startMs: number | null;
}

export interface ReportDataset {
  tickets: ReportTicket[];
  appointments: ReportAppointment[];
  error: boolean;
}

// Generous MVP caps; beyond these the dashboard silently truncates (revisit with server-side
// aggregation only if real volume ever demands it — see design.md).
const TICKET_LIMIT = 1000;
const APPOINTMENT_LIMIT = 1000;

function toMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function strOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** All tickets + all appointments for the admin reporting dashboard. */
export const getReportDataset = cache(async (): Promise<ReportDataset> => {
  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser) return { tickets: [], appointments: [], error: false };
  const store = db as Firestore;

  try {
    const [ticketSnap, apptSnap] = await Promise.all([
      getDocs(query(collection(store, "tickets"), orderBy("createdAt", "desc"), limit(TICKET_LIMIT))),
      getDocs(query(collection(store, "appointments"), orderBy("start", "desc"), limit(APPOINTMENT_LIMIT))),
    ]);

    const tickets = ticketSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        code: str(data.code),
        title: str(data.title),
        status: str(data.status),
        category: str(data.category),
        priority: str(data.priority),
        studentName: str(data.studentName),
        assigneeId: strOrNull(data.assigneeId),
        assigneeName: strOrNull(data.assigneeName),
        createdAtMs: toMillis(data.createdAt),
        resolvedAtMs: toMillis(data.resolvedAt),
        rating: numOrNull(data.rating),
      } satisfies ReportTicket;
    });

    const appointments = apptSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        status: str(data.status),
        service: str(data.service),
        advisorId: str(data.advisorId),
        advisorName: str(data.advisorName),
        startMs: toMillis(data.start),
      } satisfies ReportAppointment;
    });

    return { tickets, appointments, error: false };
  } catch (err) {
    console.error("[reports] getReportDataset failed", err);
    return { tickets: [], appointments: [], error: true };
  }
});
