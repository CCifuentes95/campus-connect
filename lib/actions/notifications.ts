"use server";

// US-06 — the Inbox's mark-read actions and the Preferences save. `notifyStudent` (the
// best-effort notification write called from inside the ticket/appointment server actions)
// lives in lib/notify.ts instead — a "use server" module's exports must take serializable
// args, and notifyStudent takes a Firestore instance. Reads/writes here go through
// FirebaseServerApp under the acting user's own credentials so firestore.rules apply.
import {
  collection,
  doc,
  type Firestore,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { revalidatePath } from "next/cache";
import { getFirestoreForUser } from "@/lib/firebase/firestore";
import {
  type NotificationPrefs,
  normalizePrefs,
  PREF_CHANNELS,
  PREF_ROWS,
  prefFieldName,
} from "@/lib/notifications";

export type MarkReadState = { status: "idle" } | { status: "error"; message: string } | { status: "success" };

export async function markNotificationRead(
  _prev: MarkReadState,
  formData: FormData,
): Promise<MarkReadState> {
  const notificationId = String(formData.get("notificationId") ?? "");
  if (!notificationId) return { status: "error", message: "Missing notification reference." };

  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser) {
    return { status: "error", message: "Your session has expired — please sign in again." };
  }

  try {
    await updateDoc(
      doc(db as Firestore, "users", currentUser.uid, "notifications", notificationId),
      { read: true },
    );
  } catch (err) {
    console.error("[notifications] markNotificationRead failed", err);
    return { status: "error", message: "Couldn't update that notification — please try again." };
  }

  revalidatePath("/notifications");
  return { status: "success" };
}

export async function markAllNotificationsRead(
  _prev: MarkReadState,
  _formData: FormData,
): Promise<MarkReadState> {
  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser) {
    return { status: "error", message: "Your session has expired — please sign in again." };
  }
  const store = db as Firestore;

  try {
    const snap = await getDocs(
      query(
        collection(store, "users", currentUser.uid, "notifications"),
        where("read", "==", false),
      ),
    );
    if (!snap.empty) {
      const batch = writeBatch(store);
      for (const d of snap.docs) batch.update(d.ref, { read: true });
      await batch.commit();
    }
  } catch (err) {
    console.error("[notifications] markAllNotificationsRead failed", err);
    return { status: "error", message: "Couldn't mark everything as read — please try again." };
  }

  revalidatePath("/notifications");
  return { status: "success" };
}

export type PreferencesState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

/** Reads the 4x3 toggle matrix off FormData (checkbox present = "on") into NotificationPrefs. */
function prefsFromFormData(formData: FormData): NotificationPrefs {
  const raw: Record<string, Record<string, boolean>> = {};
  for (const row of PREF_ROWS) {
    raw[row.key] = {};
    for (const channel of PREF_CHANNELS) {
      raw[row.key]![channel] = formData.get(prefFieldName(row.key, channel)) === "on";
    }
  }
  return normalizePrefs(raw);
}

export async function savePreferences(
  _prev: PreferencesState,
  formData: FormData,
): Promise<PreferencesState> {
  const { db, currentUser } = await getFirestoreForUser();
  if (!currentUser) {
    return { status: "error", message: "Your session has expired — please sign in again." };
  }

  const notificationPrefs = prefsFromFormData(formData);
  try {
    await updateDoc(doc(db as Firestore, "users", currentUser.uid), { notificationPrefs });
  } catch (err) {
    console.error("[notifications] savePreferences failed", err);
    return { status: "error", message: "Couldn't save your preferences — please try again." };
  }

  revalidatePath("/notifications");
  return { status: "success" };
}
