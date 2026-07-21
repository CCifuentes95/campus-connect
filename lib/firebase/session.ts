import "server-only";

// Optimistic session for routing/nav UX. Reads the role claim from the ID-token cookie.
// NOT a security boundary — firestore.rules is. Server components that read data do so via
// getAuthenticatedAppForUser() (server.ts), where rules enforce access for real.

import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE } from "./config";
import { isRole, type Role } from "../roles";

export interface SessionUser {
  uid: string;
  role: Role | null;
  email: string | null;
}

function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The signed-in user for this request (or null). Memoized per render pass. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = decodeJwtClaims(token);
  const sub = claims?.sub;
  if (typeof sub !== "string") return null;

  // Expired token → treat as signed out (the client refreshes the cookie via AuthProvider).
  const exp = typeof claims?.exp === "number" ? claims.exp * 1000 : 0;
  if (exp && Date.now() > exp) return null;

  const role = isRole(claims?.role) ? claims.role : null;
  const email = typeof claims?.email === "string" ? claims.email : null;

  return { uid: sub, role, email };
});
