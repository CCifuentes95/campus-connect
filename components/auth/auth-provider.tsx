"use client";

// Keeps the httpOnly __session cookie in sync with the Firebase client auth state.
// onIdTokenChanged fires on sign-in, sign-out, and hourly token refresh — so SSR always
// has a current ID token to read Firestore under the user (ADR-0004).

import { useEffect } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

async function postToken(idToken: string) {
  await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

async function clearToken() {
  await fetch("/api/session", { method: "DELETE" });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    return onIdTokenChanged(auth, async (user) => {
      if (user) {
        await postToken(await user.getIdToken());
      } else {
        await clearToken();
      }
    });
  }, []);

  return <>{children}</>;
}
