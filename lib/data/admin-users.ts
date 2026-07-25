import "server-only";

// Roster read for /admin/users. Admins can already read every users doc
// (`allow read: if isSelf(uid) || isStaff()`), so this is a plain FirebaseServerApp query
// under the admin's own credentials — no Admin SDK on the web tier (ADR-0004).
//
// Ordered by a SINGLE field so Firestore's automatic index covers it; counts, tab filtering,
// search, and sorting all happen in memory, matching the staff triage board's pattern. No
// composite index to declare or deploy.
import { collection, getDocs, limit, orderBy, query, Timestamp, type Firestore } from "firebase/firestore";
import { cache } from "react";
import { type AdminUser, initialsFrom, toUiRole } from "@/lib/admin-users";
import type { LoadResult } from "@/lib/data/student-dashboard";
import { getFirestoreForUser } from "@/lib/firebase/firestore";

const ROSTER_LIMIT = 500;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toRow(id: string, data: Record<string, unknown>): AdminUser {
  const displayName = str(data.displayName);
  return {
    id,
    uiRole: toUiRole(str(data.role) || "student", data.staffType),
    displayName,
    email: str(data.email),
    initials: str(data.initials) || initialsFrom(displayName),
    program: str(data.program),
    cohort: str(data.cohort),
    studentId: str(data.studentId),
    dept: str(data.dept),
    title: str(data.title),
    cats: Array.isArray(data.cats) ? data.cats.filter((c): c is string => typeof c === "string") : [],
    bookable: data.bookable === true,
    createdAtMs: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : null,
  };
}

/**
 * Every account, newest first. `error: true` is distinct from an empty roster so a failed
 * read never masquerades as "no users" (the US-02 convention).
 */
export const getAdminUsers = cache(async (): Promise<LoadResult<AdminUser>> => {
  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser) return { items: [], error: false };

  try {
    // NO orderBy: Firestore drops documents that lack the ordered field, so
    // `orderBy("createdAt")` would silently hide every account created before that field
    // existed — accounts invisible on the People & access screen. Sorting happens in memory
    // anyway (the table is sortable by four columns), so the server order is irrelevant.
    const snap = await getDocs(
      query(collection(db as Firestore, "users"), limit(ROSTER_LIMIT)),
    );
    return {
      items: snap.docs.map((d) => toRow(d.id, d.data() as Record<string, unknown>)),
      error: false,
    };
  } catch (err) {
    console.error("[admin-users] roster read failed", err);
    return { items: [], error: true };
  }
});

/** One account for the detail screen. Returns null for missing OR unreadable (never leaks). */
export const getAdminUser = cache(async (uid: string): Promise<AdminUser | null> => {
  const { items, error } = await getAdminUsers();
  if (error) return null;
  return items.find((u) => u.id === uid) ?? null;
});

export interface ActivityItem {
  id: string;
  code: string;
  title: string;
  status: string;
  updatedAtMs: number | null;
}

const ACTIVITY_SCAN = 200;
const ACTIVITY_SHOWN = 3;

/**
 * The detail sidebar's "Recent activity" (student) / "Current workload" (staff). Staff read
 * all tickets, so this is one bounded single-field-ordered fetch filtered in memory by
 * `studentId` or `assigneeId` — no composite index, same trade-off as the triage board.
 */
export const getUserActivity = cache(
  async (uid: string, forStudent: boolean): Promise<ActivityItem[]> => {
    const { db, currentUser } = await getFirestoreForUser();
    if (!currentUser) return [];

    try {
      const snap = await getDocs(
        query(
          collection(db as Firestore, "tickets"),
          orderBy("updatedAt", "desc"),
          limit(ACTIVITY_SCAN),
        ),
      );
      return snap.docs
        .filter((d) => {
          const data = d.data() as Record<string, unknown>;
          return forStudent ? data.studentId === uid : data.assigneeId === uid;
        })
        .slice(0, ACTIVITY_SHOWN)
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            code: str(data.code),
            title: str(data.title),
            status: str(data.status),
            updatedAtMs: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : null,
          };
        });
    } catch (err) {
      console.error("[admin-users] activity read failed", err);
      return [];
    }
  },
);
