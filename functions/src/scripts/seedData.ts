/**
 * Seed sample tickets + appointments for the student dashboard on the REAL project
 * (dev/demo utility). Admin SDK bypasses rules, so it can set realistic statuses/assignees a
 * student could never write directly. Idempotent: deterministic doc ids, so re-running updates
 * in place instead of duplicating.
 *
 * Usage (build first with `npm run build`):
 *   GOOGLE_APPLICATION_CREDENTIALS=../service-account.json \
 *   FIREBASE_PROJECT_ID=campus-connect-503020 \
 *   node lib/scripts/seedData.js
 *
 * Accounts must already exist (student@myibu.ca, advisor@myibu.ca).
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const STUDENT_EMAIL = "student@myibu.ca";
const ADVISOR_EMAIL = "advisor@myibu.ca";
const STUDENT_NAME = "Amara Okafor";
const ADVISOR_NAME = "Dana Osei";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();
const ts = (msFromNow: number) => Timestamp.fromMillis(now + msFromNow);

/** A Timestamp `daysAhead` days from now, pinned to a clean local `hour`:00 (negative = past). */
function atClock(daysAhead: number, hour: number): Timestamp {
  const d = new Date(now);
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return Timestamp.fromMillis(d.getTime());
}

async function main() {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
    console.error("An emulator host is set — this script targets the REAL project. Unset it.");
    process.exit(1);
  }

  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  const auth = getAuth();
  const db = getFirestore();

  const student = await auth.getUserByEmail(STUDENT_EMAIL);
  const advisor = await auth.getUserByEmail(ADVISOR_EMAIL).catch(() => null);
  const advisorId = advisor?.uid ?? "advisor-unknown";
  console.log(`student ${student.uid}  advisor ${advisorId}`);

  // ---- student profile (so the dashboard greeting + nav show a real name, not the email) ----
  await db.collection("users").doc(student.uid).set(
    {
      uid: student.uid,
      email: STUDENT_EMAIL,
      displayName: STUDENT_NAME,
      initials: "AO",
      role: "student",
      program: "MSc International Business",
    },
    { merge: true },
  );
  console.log(`  profile ${STUDENT_NAME}`);

  // ---- tickets (studentId = the student; varied status/priority/category) ----
  const tickets = [
    {
      id: "seed-req-2041",
      code: "REQ-2041",
      title: "Registration hold on BCOM 301",
      category: "registration",
      priority: "high",
      status: "waiting_for_student", // student sees "Waiting for you"
      updatedFromNow: -2 * HOUR,
    },
    {
      id: "seed-req-2042",
      code: "REQ-2042",
      title: "Transcript request for study abroad",
      category: "records",
      priority: "medium",
      status: "assigned", // "In progress"
      updatedFromNow: -1 * DAY,
    },
    {
      id: "seed-req-2039",
      code: "REQ-2039",
      title: "Financial aid disbursement timing",
      category: "financial_aid",
      priority: "low",
      status: "resolved",
      updatedFromNow: -3 * DAY,
    },
    {
      id: "seed-req-2035",
      code: "REQ-2035",
      title: "Can't connect laptop to campus Wi-Fi",
      category: "it",
      priority: "medium",
      status: "closed", // not counted as open; falls outside the top-3 preview
      updatedFromNow: -6 * DAY,
    },
  ];

  for (const t of tickets) {
    await db.collection("tickets").doc(t.id).set({
      code: t.code,
      title: t.title,
      description: `Seeded sample: ${t.title}.`,
      category: t.category,
      priority: t.priority,
      status: t.status,
      studentId: student.uid,
      studentName: STUDENT_NAME,
      assigneeId: t.status === "new" ? null : advisorId,
      assigneeName: t.status === "new" ? null : ADVISOR_NAME,
      createdAt: ts(t.updatedFromNow - DAY),
      updatedAt: ts(t.updatedFromNow),
      lastActorName: t.status === "waiting_for_student" ? ADVISOR_NAME : STUDENT_NAME,
      lastMessageAt: ts(t.updatedFromNow),
      resolvedAt: t.status === "resolved" ? ts(t.updatedFromNow) : null,
      nextAction: null,
      rating: null,
    });
    console.log(`  ticket ${t.code} (${t.status})`);
  }

  // ---- decoy ticket owned by a DIFFERENT student → must NOT show on this dashboard ----
  await db.collection("tickets").doc("seed-req-decoy").set({
    code: "REQ-9999",
    title: "DECOY — belongs to another student",
    description: "Isolation check: should never appear on student@myibu.ca's dashboard.",
    category: "other",
    priority: "high",
    status: "assigned",
    studentId: "decoy-student-uid-000",
    studentName: "Someone Else",
    assigneeId: advisorId,
    assigneeName: ADVISOR_NAME,
    createdAt: ts(-1 * HOUR),
    updatedAt: ts(-1 * HOUR),
    lastActorName: ADVISOR_NAME,
    lastMessageAt: ts(-1 * HOUR),
    resolvedAt: null,
    nextAction: null,
    rating: null,
  });
  console.log("  ticket REQ-9999 (decoy, other student)");

  // ---- appointments (start pinned to clean local times; past one excluded from the lane) ----
  const appointments = [
    {
      id: "seed-apt-2048",
      code: "APT-2048",
      service: "academic_advising",
      title: "Academic planning session",
      daysAhead: 1,
      hour: 10,
      durationMin: 45,
      mode: "video",
      location: "Join by video",
    },
    {
      id: "seed-apt-2051",
      code: "APT-2051",
      service: "career",
      title: "Career planning & internships",
      daysAhead: 4,
      hour: 14,
      durationMin: 45,
      mode: "in_person",
      location: "Student Services, Room 214",
    },
    {
      id: "seed-apt-2044",
      code: "APT-2044",
      service: "financial_aid",
      title: "Scholarship options review",
      daysAhead: -5, // past → must NOT appear in the upcoming lane
      hour: 11,
      durationMin: 30,
      mode: "phone",
      location: "Phone call",
    },
  ];

  for (const a of appointments) {
    const start = atClock(a.daysAhead, a.hour);
    await db.collection("appointments").doc(a.id).set({
      code: a.code,
      service: a.service,
      title: a.title,
      studentId: student.uid,
      studentName: STUDENT_NAME,
      advisorId,
      advisorName: ADVISOR_NAME,
      start,
      end: Timestamp.fromMillis(start.toMillis() + a.durationMin * 60 * 1000),
      mode: a.mode,
      location: a.location,
      status: "booked",
      notes: "",
      createdAt: ts(-2 * DAY),
    });
    console.log(`  appointment ${a.code} (${a.daysAhead < 0 ? "past" : "upcoming"})`);
  }

  console.log("\nDone. Sign in as", STUDENT_EMAIL, "to see the populated dashboard.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
