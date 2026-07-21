import "server-only";

// FirebaseServerApp for SSR: reads Firestore under the signed-in user's ID token so
// firestore.rules apply (ADR-0004). No Admin SDK on the web tier.
import { initializeServerApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { cookies } from "next/headers";
import { firebaseConfig, SESSION_COOKIE } from "./config";

/**
 * Initialize a per-request FirebaseServerApp seeded with the user's ID token (from the
 * session cookie). Use the returned app to construct Firestore instances that read as the
 * user. `currentUser` is null when there is no valid token.
 */
export async function getAuthenticatedAppForUser() {
  const authIdToken = (await cookies()).get(SESSION_COOKIE)?.value;

  const firebaseServerApp = initializeServerApp(
    firebaseConfig,
    authIdToken ? { authIdToken } : {},
  );

  const auth = getAuth(firebaseServerApp);
  await auth.authStateReady();

  return { firebaseServerApp, currentUser: auth.currentUser };
}
