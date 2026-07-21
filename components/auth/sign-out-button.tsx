"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export function SignOutButton({ className }: { className?: string }) {
  async function handleSignOut() {
    await signOut(auth); // AuthProvider's onIdTokenChanged clears the cookie
    await fetch("/api/session", { method: "DELETE" }); // ensure cleared before navigating
    window.location.assign("/login"); // full nav so the cleared cookie is honored server-side
  }

  return (
    <button type="button" onClick={handleSignOut} className={className}>
      Sign out
    </button>
  );
}
