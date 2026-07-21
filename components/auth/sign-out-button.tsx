"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut(auth); // AuthProvider's onIdTokenChanged clears the cookie
    await fetch("/api/session", { method: "DELETE" }); // ensure cleared before navigating
    router.replace("/login");
  }

  return (
    <button type="button" onClick={handleSignOut} className={className}>
      Sign out
    </button>
  );
}
