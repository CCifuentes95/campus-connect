import "server-only";

// Track Ticket detail read (US-05): one tickets/{id} + its PUBLIC events, through
// FirebaseServerApp under the student so firestore.rules apply (no Admin SDK). Two subtleties:
//   1. A non-owner read is DENIED by the rules (throws permission-denied) — we map that to the
//      same not-found result as an absent doc, deliberately conflating "missing" and "not yours"
//      so we never leak the existence of another student's ticket.
//   2. Firestore rules are NOT filters: the events query MUST constrain visibility == "public"
//      (the read rule only permits public events to the owning student) or the whole query is
//      rejected. We sort by createdAt in memory rather than add `orderBy` — an equality filter is
//      served by the automatic single-field index, so no composite index needs deploying.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
  type Firestore,
} from "firebase/firestore";
import { cache } from "react";
import { getFirestoreForUser } from "@/lib/firebase/firestore";

export interface TicketDetail {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  studentName: string;
  assigneeName: string | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
}

export interface TicketEvent {
  id: string;
  type: string;
  actorName: string;
  actorRole: string;
  message: string;
  fromStatus: string | null;
  toStatus: string | null;
  createdAtMs: number | null;
}

/** Three-way so an infra failure never masquerades as a legitimately missing ticket. */
export type TicketDetailResult =
  | { kind: "found"; ticket: TicketDetail; events: TicketEvent[] }
  | { kind: "not_found" }
  | { kind: "error" };

function toMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function strOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** A rules denial reads as not-found (don't leak other students' tickets); anything else is an
 * error the page surfaces distinctly. */
function isPermissionDenied(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "permission-denied"
  );
}

export const getTicketDetail = cache(
  async (id: string): Promise<TicketDetailResult> => {
    const { db, currentUser } = await getFirestoreForUser();
    if (!currentUser) return { kind: "not_found" };
    const store = db as Firestore;

    let ticket: TicketDetail;
    try {
      const snap = await getDoc(doc(store, "tickets", id));
      if (!snap.exists()) return { kind: "not_found" };
      const data = snap.data();
      // Belt-and-suspenders: the rules already deny a non-owner read, but guard anyway.
      if (data.studentId !== currentUser.uid) return { kind: "not_found" };
      ticket = {
        id: snap.id,
        code: str(data.code),
        title: str(data.title),
        description: str(data.description),
        category: str(data.category),
        priority: str(data.priority),
        status: str(data.status),
        studentName: str(data.studentName),
        assigneeName: strOrNull(data.assigneeName),
        createdAtMs: toMillis(data.createdAt),
        updatedAtMs: toMillis(data.updatedAt),
      };
    } catch (err) {
      if (isPermissionDenied(err)) return { kind: "not_found" };
      console.error("[ticket-detail] ticket read failed", err);
      return { kind: "error" };
    }

    // Public events only (rules constraint). Sort oldest-first in memory — tiny per ticket.
    let events: TicketEvent[] = [];
    try {
      const snap = await getDocs(
        query(
          collection(store, "tickets", id, "events"),
          where("visibility", "==", "public"),
        ),
      );
      events = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: str(data.type),
            actorName: str(data.actorName),
            actorRole: str(data.actorRole),
            message: str(data.message),
            fromStatus: strOrNull(data.fromStatus),
            toStatus: strOrNull(data.toStatus),
            createdAtMs: toMillis(data.createdAt),
          } satisfies TicketEvent;
        })
        .sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0));
    } catch (err) {
      // The ticket loaded; a failed events read shouldn't 404 the page. Log and show an empty
      // timeline (the header/stepper/sidebar still render).
      console.error("[ticket-detail] events read failed", err);
    }

    return { kind: "found", ticket, events };
  },
);
