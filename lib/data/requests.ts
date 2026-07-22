import "server-only";

// Read for the Requests list (US-03). One query scoped to studentId == uid ordered by
// updatedAt desc, through FirebaseServerApp so firestore.rules apply. Filtering and sorting
// happen in-memory on the client (see components/requests/requests-list.tsx) — data volume
// per student is tiny, so a single fetch beats per-filter queries + their composite indexes.
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  type Firestore,
} from "firebase/firestore";
import { cache } from "react";
import type { DashboardTicket, LoadResult } from "@/lib/data/student-dashboard";
import { getFirestoreForUser } from "@/lib/firebase/firestore";

/** A request-list row: the dashboard ticket fields plus createdAt (for the "Date opened" sort). */
export interface ListTicket extends DashboardTicket {
  createdAtMs: number | null;
}

// Well above realistic MVP volume for one student; a student over this would silently truncate
// (revisit with pagination if it ever matters).
const LIST_LIMIT = 100;

function toMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** All of the signed-in student's tickets, most-recently-updated first. */
export const getStudentTickets = cache(
  async (): Promise<LoadResult<ListTicket>> => {
    const { db, currentUser } = await getFirestoreForUser();
    if (!currentUser) return { items: [], error: false };

    try {
      const snap = await getDocs(
        query(
          collection(db as Firestore, "tickets"),
          where("studentId", "==", currentUser.uid),
          orderBy("updatedAt", "desc"),
          limit(LIST_LIMIT),
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
          createdAtMs: toMillis(data.createdAt),
        } satisfies ListTicket;
      });
      return { items, error: false };
    } catch (err) {
      console.error("[requests] getStudentTickets failed", err);
      return { items: [], error: true };
    }
  },
);
