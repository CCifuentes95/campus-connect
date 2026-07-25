import "server-only";

// Callable Cloud Functions invoked from server actions, as the signed-in user.
//
// NOT `getFunctions(firebaseServerApp)` + `httpsCallable`. That was the first attempt and it
// fails INTERMITTENTLY, which is worse than failing outright. The Functions SDK's
// ContextProvider does:
//
//     this.auth = authProvider.getImmediate({ optional: true });
//     if (!this.auth) authProvider.get().then(auth => (this.auth = auth));
//
// Under a FirebaseServerApp `getImmediate` returns null, so the token is only attached if
// that async `.get()` happens to resolve before `getAuthToken()` runs. Most calls therefore
// reached the function with `request.auth` undefined and threw `unauthenticated`, while the
// occasional one succeeded. Observed both outcomes against the deployed function.
//
// Instead we speak the callable protocol over plain HTTPS: POST {data}, with the session
// cookie's ID token as a bearer. That is exactly what the client SDK does on the wire, and
// it populates `request.auth.token.role` inside the function, so the admin gate works. The
// Admin SDK still never runs on Vercel (ADR-0004) — this is the user's own ID token.
import { cookies } from "next/headers";
import { firebaseConfig, SESSION_COOKIE } from "./config";

/** Cloud Functions region — matches the deployed adminManageUser / setRole (us-central1). */
const REGION = "us-central1";

/** The callable protocol's error envelope, re-thrown in the client SDK's code shape. */
export class CallableError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CallableError";
  }
}

/** `PERMISSION_DENIED` -> `permission-denied`, matching the client SDK's error codes. */
function normalizeStatus(status: unknown): string {
  return typeof status === "string" ? status.toLowerCase().replace(/_/g, "-") : "internal";
}

/**
 * Call a Cloud Function as the signed-in user. `signedIn: false` when there is no session
 * cookie, so callers can surface an expired-session message rather than a 500.
 */
export async function callAsUser<Req, Res>(
  name: string,
  data: Req,
): Promise<{ result: Res | null; signedIn: boolean }> {
  const idToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!idToken) return { result: null, signedIn: false };

  const url = `https://${REGION}-${firebaseConfig.projectId}.cloudfunctions.net/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  const payload = (await res.json().catch(() => null)) as
    | { result?: Res; error?: { status?: string; message?: string; details?: unknown } }
    | null;

  if (payload?.error) {
    throw new CallableError(
      normalizeStatus(payload.error.status),
      payload.error.message ?? "Cloud Function call failed.",
      payload.error.details,
    );
  }
  if (!res.ok || !payload) {
    throw new CallableError("internal", `Cloud Function ${name} returned ${res.status}.`);
  }

  return { result: payload.result ?? null, signedIn: true };
}
