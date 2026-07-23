import "server-only";

// Staff triage reads (US-07). Staff read every ticket (firestore.rules `isStaff()`), so unlike
// the student reads these are NOT scoped to a studentId. One bounded fetch ordered by a single
// field (automatic index — no composite index to deploy); the board computes KPIs, grouping,
// filters and sort in memory from that one set (US-02/US-05 pattern). All reads go through
// FirebaseServerApp under the signed-in staff member — never the Admin SDK (ADR-0004).
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import { cache } from "react";
import { getFirestoreForUser } from "@/lib/firebase/firestore";

/** A triage-board row — everything the board and its cards render, all serializable. */
export interface BoardTicket {
  id: string;
  code: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  studentName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  nextAction: string | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
  lastMessageAtMs: number | null;
}

export interface BoardResult {
  tickets: BoardTicket[];
  error: boolean;
}

// Well above realistic MVP volume; beyond this the board silently truncates (revisit with
// pagination if it ever matters — see design.md).
const BOARD_LIMIT = 200;

function toMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function strOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function isPermissionDenied(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "permission-denied"
  );
}

/** Every ticket, most-recently-updated first, for the triage board. */
export const getTriageBoard = cache(async (): Promise<BoardResult> => {
  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser) return { tickets: [], error: false };
  try {
    const snap = await getDocs(
      query(
        collection(db as Firestore, "tickets"),
        orderBy("updatedAt", "desc"),
        limit(BOARD_LIMIT),
      ),
    );
    const tickets = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        code: str(data.code),
        title: str(data.title),
        category: str(data.category),
        priority: str(data.priority),
        status: str(data.status),
        studentName: str(data.studentName),
        assigneeId: strOrNull(data.assigneeId),
        assigneeName: strOrNull(data.assigneeName),
        nextAction: strOrNull(data.nextAction),
        createdAtMs: toMillis(data.createdAt),
        updatedAtMs: toMillis(data.updatedAt),
        lastMessageAtMs: toMillis(data.lastMessageAt),
      } satisfies BoardTicket;
    });
    return { tickets, error: false };
  } catch (err) {
    console.error("[staff-tickets] getTriageBoard failed", err);
    return { tickets: [], error: true };
  }
});

// ---- Staff ticket detail ----

export interface StaffTicket {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  studentId: string;
  studentName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  nextAction: string | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
  resolvedAtMs: number | null;
  lastMessageAtMs: number | null;
}

/** A staff-visible event — includes internal notes (visibility === "internal"). */
export interface StaffTicketEvent {
  id: string;
  type: string;
  visibility: string;
  actorName: string;
  actorRole: string;
  message: string;
  fromStatus: string | null;
  toStatus: string | null;
  createdAtMs: number | null;
}

export type StaffTicketResult =
  | { kind: "found"; ticket: StaffTicket; events: StaffTicketEvent[] }
  | { kind: "not_found" }
  | { kind: "error" };

/** One ticket + ALL of its events (staff see every visibility). Sorted oldest-first in
 * memory. A rules denial (a non-staff caller) maps to not_found, like the student read. */
export const getStaffTicketDetail = cache(
  async (id: string): Promise<StaffTicketResult> => {
    const { db, currentUser } = await getFirestoreForUser();
    if (!currentUser) return { kind: "not_found" };
    const store = db as Firestore;

    let ticket: StaffTicket;
    try {
      const snap = await getDoc(doc(store, "tickets", id));
      if (!snap.exists()) return { kind: "not_found" };
      const data = snap.data();
      ticket = {
        id: snap.id,
        code: str(data.code),
        title: str(data.title),
        description: str(data.description),
        category: str(data.category),
        priority: str(data.priority),
        status: str(data.status),
        studentId: str(data.studentId),
        studentName: str(data.studentName),
        assigneeId: strOrNull(data.assigneeId),
        assigneeName: strOrNull(data.assigneeName),
        nextAction: strOrNull(data.nextAction),
        createdAtMs: toMillis(data.createdAt),
        updatedAtMs: toMillis(data.updatedAt),
        resolvedAtMs: toMillis(data.resolvedAt),
        lastMessageAtMs: toMillis(data.lastMessageAt),
      };
    } catch (err) {
      if (isPermissionDenied(err)) return { kind: "not_found" };
      console.error("[staff-tickets] detail read failed", err);
      return { kind: "error" };
    }

    let events: StaffTicketEvent[] = [];
    try {
      const snap = await getDocs(collection(store, "tickets", id, "events"));
      events = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: str(data.type),
            visibility: str(data.visibility),
            actorName: str(data.actorName),
            actorRole: str(data.actorRole),
            message: str(data.message),
            fromStatus: strOrNull(data.fromStatus),
            toStatus: strOrNull(data.toStatus),
            createdAtMs: toMillis(data.createdAt),
          } satisfies StaffTicketEvent;
        })
        .sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0));
    } catch (err) {
      console.error("[staff-tickets] events read failed", err);
    }

    return { kind: "found", ticket, events };
  },
);
