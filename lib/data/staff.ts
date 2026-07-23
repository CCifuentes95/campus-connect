import "server-only";

// Staff roster read (US-07): the advisors/admins offered in the triage "Assign to…" /
// "Reassign…" pickers. Read through FirebaseServerApp under the signed-in staff member —
// firestore.rules lets isStaff() read any user doc, so a query over `users` is permitted.
// `role` is the denormalized display mirror on the profile (data-model.md); an equality/`in`
// filter on it uses the automatic single-field index — no composite index to deploy.
import {
  collection,
  getDocs,
  query,
  where,
  type Firestore,
} from "firebase/firestore";
import { cache } from "react";
import { getFirestoreForUser } from "@/lib/firebase/firestore";

export interface StaffMember {
  uid: string;
  displayName: string;
  initials: string;
  title: string;
}

const ROSTER_LIMIT = 100;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** All advisors + admins, for the assignee pickers. Sorted by display name in memory. */
export const getStaffRoster = cache(async (): Promise<StaffMember[]> => {
  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db as Firestore, "users"),
        where("role", "in", ["advisor", "admin"]),
      ),
    );
    return snap.docs
      .slice(0, ROSTER_LIMIT)
      .map((d) => {
        const data = d.data();
        const displayName = str(data.displayName) || str(data.email) || "Staff";
        return {
          uid: d.id,
          displayName,
          initials: str(data.initials) || displayName.slice(0, 2).toUpperCase(),
          title: str(data.title),
        } satisfies StaffMember;
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  } catch (err) {
    console.error("[staff] getStaffRoster failed", err);
    return [];
  }
});
