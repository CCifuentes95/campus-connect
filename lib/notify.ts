// Plain helper (NOT a server action — takes a Firestore instance, so it must live outside a
// "use server" module) for the best-effort notification write called from inside the existing
// ticket/appointment server actions. No Cloud Functions are deployed in this MVP, so this runs
// inline, after the caller's primary write already succeeded. Never throws — a failure here
// must not surface as a failure of the action the student actually asked for (matches the
// US-03 event-write convention). `firestore.rules` requires `read:false` and a closed `type`
// enum matching NOTIFICATION_TYPES.
import { addDoc, collection, type Firestore, serverTimestamp } from "firebase/firestore";
import { isEnabled } from "@/lib/flags";
import type { NotificationType } from "@/lib/notifications";

export async function notifyStudent(params: {
  db: Firestore;
  uid: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  refId: string;
}): Promise<void> {
  // When notifications are flagged off, skip the write entirely so no orphan notifications
  // accrue for a disabled feature (the inbox route + actions are gated separately).
  if (!isEnabled("notifications")) return;
  const { db, uid, type, title, body, link, refId } = params;
  try {
    await addDoc(collection(db, "users", uid, "notifications"), {
      type,
      title,
      body,
      link,
      refId,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("[notifications] notifyStudent write failed", err);
  }
}
