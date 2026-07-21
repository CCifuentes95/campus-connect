/**
 * Set a user's role on the REAL Firebase project (dev/admin utility).
 *
 * Custom claims can only be set with the Admin SDK, so this needs a service-account key:
 *   1. Firebase console → Project settings → Service accounts → Generate new private key
 *   2. Save it OUTSIDE git (it's gitignored as service-account*.json)
 *
 * Usage (build first with `npm run build`):
 *   GOOGLE_APPLICATION_CREDENTIALS=../service-account.json \
 *   FIREBASE_PROJECT_ID=campus-connect-503020 \
 *   node lib/scripts/setRole.js <email> <student|advisor|admin>
 *
 * The user must already exist (create it in console → Authentication → Add user).
 * They must re-login (or refresh their token) for the new role to take effect.
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const ROLES = ["student", "advisor", "admin"];

async function main() {
  const email = process.argv[2];
  const role = process.argv[3] ?? "admin";

  if (!email || !ROLES.includes(role)) {
    console.error("Usage: node lib/scripts/setRole.js <email> <student|advisor|admin>");
    process.exit(1);
  }
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.error(
      "FIREBASE_AUTH_EMULATOR_HOST is set — this script targets the REAL project. Unset it first.",
    );
    process.exit(1);
  }

  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  let user;
  try {
    user = await getAuth().getUserByEmail(email);
  } catch {
    console.error(
      `No account for ${email}. Create it first: Firebase console → Authentication → Add user.`,
    );
    process.exit(1);
  }

  await getAuth().setCustomUserClaims(user.uid, { role });

  try {
    await getFirestore().collection("users").doc(user.uid).set({ role }, { merge: true });
  } catch (err) {
    console.warn(
      "(profile mirror skipped — is Firestore enabled for the project?)",
      (err as Error).message,
    );
  }

  console.log(`Set role=${role} for ${email} (uid ${user.uid}). Re-login to pick it up.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
