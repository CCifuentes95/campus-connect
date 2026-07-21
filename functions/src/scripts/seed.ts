/**
 * Seed local test users into the Firebase EMULATOR (dev only).
 *
 * Creates one signed-in-able account per role, each with its `role` custom claim and a
 * users/{uid} profile doc, so you can exercise login + role gating without the cloud.
 *
 * Safe by construction: refuses to run unless the Auth emulator host is set, so it can
 * never touch the real project.
 *
 * Run via `pnpm seed` (see root package.json), or directly:
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_PROJECT_ID=campus-connect-503020 \
 *   node lib/scripts/seed.js
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error(
    "Refusing to run: FIREBASE_AUTH_EMULATOR_HOST is not set (this script is emulator-only).",
  );
  process.exit(1);
}

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "campus-connect-503020";
initializeApp({ projectId: PROJECT_ID });

const PASSWORD = "password123";
const USERS = [
  { email: "student@ibu.edu", role: "student", displayName: "Amara Okafor" },
  { email: "advisor@ibu.edu", role: "advisor", displayName: "Dana Osei" },
  { email: "admin@ibu.edu", role: "admin", displayName: "Lena Fischer" },
] as const;

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function upsert(u: (typeof USERS)[number]) {
  const auth = getAuth();
  let user;
  try {
    user = await auth.getUserByEmail(u.email);
  } catch {
    user = await auth.createUser({
      email: u.email,
      password: PASSWORD,
      displayName: u.displayName,
    });
  }

  await auth.setCustomUserClaims(user.uid, { role: u.role });
  await getFirestore()
    .collection("users")
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        email: u.email,
        displayName: u.displayName,
        initials: initialsFrom(u.displayName),
        role: u.role,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  console.log(`seeded ${u.role.padEnd(8)} ${u.email}  (password: ${PASSWORD})`);
}

async function main() {
  for (const u of USERS) await upsert(u);
  console.log("\nDone. Sign in at http://localhost:3000/login");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
