import "server-only";

// Firestore reads for server components, scoped to the signed-in user. Built on the
// per-request FirebaseServerApp (server.ts) so firestore.rules enforce access under the
// user's own ID token — never the Admin SDK on the web tier (ADR-0004).
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuthenticatedAppForUser } from "./server";

/**
 * A Firestore instance that reads as the signed-in user, plus that user (or null when there
 * is no valid session). Callers that need data must check `currentUser` first.
 */
export async function getFirestoreForUser(): Promise<{
  db: Firestore;
  currentUser: Awaited<
    ReturnType<typeof getAuthenticatedAppForUser>
  >["currentUser"];
}> {
  const { firebaseServerApp, currentUser } = await getAuthenticatedAppForUser();
  return { db: getFirestore(firebaseServerApp), currentUser };
}
