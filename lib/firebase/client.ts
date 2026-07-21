"use client";

// Client Firebase app + Auth (browser). Singleton across HMR/navigations.
import { getApps, initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { firebaseConfig, useEmulators } from "./config";

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);

// Local dev against the Auth emulator (NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true).
if (
  useEmulators &&
  typeof window !== "undefined" &&
  !(globalThis as { __ccAuthEmu?: boolean }).__ccAuthEmu
) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  (globalThis as { __ccAuthEmu?: boolean }).__ccAuthEmu = true;
}
