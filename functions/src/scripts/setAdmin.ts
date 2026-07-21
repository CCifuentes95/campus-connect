/**
 * One-off admin bootstrap (US-01 task 3.3).
 *
 * `setRole` requires an admin caller, so the very first admin must be seeded out-of-band.
 * This script grants the `admin` role claim to a user by email using the Admin SDK.
 *
 * Build first (`npm run build`), then run against the target project:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *   FIREBASE_PROJECT_ID=campus-connect-503020 \
 *   node lib/scripts/setAdmin.js someone@ibu.edu
 *
 * Or against the Auth emulator:
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   node lib/scripts/setAdmin.js someone@ibu.edu
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node lib/scripts/setAdmin.js <email>");
    process.exit(1);
  }

  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  const user = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid, { role: "admin" });
  await getFirestore().collection("users").doc(user.uid).set({ role: "admin" }, { merge: true });

  console.log(`Granted admin to ${email} (uid: ${user.uid}). They must refresh their token.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
