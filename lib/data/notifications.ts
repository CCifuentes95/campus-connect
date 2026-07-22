import "server-only";

// Notification inbox read (US-06): the caller's own notifications, through FirebaseServerApp
// under the student so firestore.rules apply (no Admin SDK). A single query (ordered
// createdAt desc, no `read` filter) — the Unread/All-read toggle and Today/Earlier grouping
// are applied in-memory on the client, matching the support-requests list's established
// "single fetch, filter client-side" convention (`components/requests/requests-list.tsx`).
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
import { type NotificationPrefs, normalizePrefs } from "@/lib/notifications";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  refId: string;
  read: boolean;
  createdAtMs: number | null;
}

export type NotificationsResult =
  | { kind: "found"; items: NotificationItem[] }
  | { kind: "error" };

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function toMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

export const getNotifications = cache(
  async (): Promise<NotificationsResult> => {
    const { db, currentUser } = await getFirestoreForUser();
    if (!currentUser) return { kind: "found", items: [] };
    const store = db as Firestore;

    try {
      const snap = await getDocs(
        query(
          collection(store, "users", currentUser.uid, "notifications"),
          orderBy("createdAt", "desc"),
        ),
      );
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: str(data.type),
          title: str(data.title),
          body: str(data.body),
          link: str(data.link),
          refId: str(data.refId),
          read: Boolean(data.read),
          createdAtMs: toMillis(data.createdAt),
        } satisfies NotificationItem;
      });
      return { kind: "found", items };
    } catch (err) {
      console.error("[notifications] read failed", err);
      return { kind: "error" };
    }
  },
);

export const getNotificationPrefs = cache(
  async (): Promise<NotificationPrefs> => {
    const { db, currentUser } = await getFirestoreForUser();
    if (!currentUser) return normalizePrefs(undefined);
    try {
      const snap = await getDoc(doc(db as Firestore, "users", currentUser.uid));
      return normalizePrefs(snap.exists() ? snap.data().notificationPrefs : undefined);
    } catch (err) {
      console.error("[notifications] getNotificationPrefs failed", err);
      return normalizePrefs(undefined);
    }
  },
);

/** Cheap existence check for the nav bell — no full read, just "is there at least one". */
export async function hasUnreadNotifications(): Promise<boolean> {
  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser) return false;
  const store = db as Firestore;
  try {
    const snap = await getDocs(
      query(
        collection(store, "users", currentUser.uid, "notifications"),
        where("read", "==", false),
        limit(1),
      ),
    );
    return !snap.empty;
  } catch (err) {
    console.error("[notifications] unread check failed", err);
    return false;
  }
}
