import "server-only";

// Callable Cloud Functions invoked from server actions, scoped to the signed-in user.
//
// The Functions SDK resolves its auth token from the app's `auth-internal` provider
// (ContextProvider.getAuthToken -> auth.getToken), which a FirebaseServerApp seeded with the
// session cookie's ID token populates — so `request.auth.token.role` is available inside the
// function and the admin gate works. The Admin SDK is still never used on Vercel (ADR-0004);
// all privileged work happens inside the function.
import { getFunctions, httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { getAuthenticatedAppForUser } from "./server";

/**
 * Call a Cloud Function as the signed-in user. Returns null for `currentUser` when there is
 * no valid session, so callers can surface an expired-session message instead of a 500.
 */
export async function callAsUser<Req, Res>(
  name: string,
  data: Req,
): Promise<{ result: HttpsCallableResult<Res> | null; signedIn: boolean }> {
  const { firebaseServerApp, currentUser } = await getAuthenticatedAppForUser();
  if (!currentUser) return { result: null, signedIn: false };

  const fn = httpsCallable<Req, Res>(getFunctions(firebaseServerApp), name);
  return { result: await fn(data), signedIn: true };
}
