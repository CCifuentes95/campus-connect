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
const ADMIN_EMAIL = "admin@myibu.ca";
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
      resolvedAt: t.status === "resolved" || t.status === "closed" ? ts(t.updatedFromNow) : null,
      nextAction: null,
      // satisfaction is seeded (no rating-collection UI yet) — feeds the admin KPI/trend.
      rating: t.status === "resolved" || t.status === "closed" ? 4 : null,
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

  // ---- notifications (US-06 — a few per wired type, mixed read/unread, Today + Earlier) ----
  // NOT appointment_reminder — no scheduled function produces that in this MVP (see
  // openspec/changes/notifications-preferences/design.md), so no fake reminder rows here.
  const notifications = [
    {
      id: "seed-notif-1",
      type: "ticket_reply",
      title: "Reply posted",
      body: "Your reply on REQ-2041 was posted.",
      link: "/requests/seed-req-2041",
      refId: "seed-req-2041",
      read: false,
      createdFromNow: -2 * HOUR,
    },
    {
      id: "seed-notif-2",
      type: "appointment_booked",
      title: "Appointment booked",
      body: "Academic advising with Dana Osei is confirmed.",
      link: "/appointments/seed-apt-2048",
      refId: "seed-apt-2048",
      read: false,
      createdFromNow: -5 * HOUR,
    },
    {
      id: "seed-notif-3",
      type: "ticket_update",
      title: "Request reopened",
      body: "You reopened REQ-2039.",
      link: "/requests/seed-req-2039",
      refId: "seed-req-2039",
      read: true,
      createdFromNow: -1 * DAY,
    },
    {
      id: "seed-notif-4",
      type: "appointment_cancelled",
      title: "Appointment cancelled",
      body: "Your Scholarship options review appointment was cancelled.",
      link: "/appointments/seed-apt-2044",
      refId: "seed-apt-2044",
      read: true,
      createdFromNow: -2 * DAY,
    },
    {
      id: "seed-notif-5",
      type: "appointment_booked",
      title: "Appointment booked",
      body: "Career planning & internships with Dana Osei is confirmed.",
      link: "/appointments/seed-apt-2051",
      refId: "seed-apt-2051",
      read: true,
      createdFromNow: -5 * DAY,
    },
  ];

  for (const n of notifications) {
    await db
      .collection("users")
      .doc(student.uid)
      .collection("notifications")
      .doc(n.id)
      .set({
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        refId: n.refId,
        read: n.read,
        createdAt: ts(n.createdFromNow),
      });
    console.log(`  notification ${n.type} (${n.read ? "read" : "unread"})`);
  }

  // ==========================================================================
  // US-07 staff triage board seed
  // ==========================================================================

  // ---- staff profiles (so getStaffRoster returns real names + the "assigned to me" KPI
  //      resolves for advisor@myibu.ca). onUserCreate isn't deployed, so seed these directly.
  await db.collection("users").doc(advisorId).set(
    {
      uid: advisorId,
      email: ADVISOR_EMAIL,
      displayName: ADVISOR_NAME,
      initials: "DO",
      role: "advisor",
      title: "Academic Advisor",
    },
    { merge: true },
  );
  // A second staff member (profile-only — no auth account) so Reassign… has a target.
  const PRIYA_ID = "seed-staff-priya";
  const PRIYA_NAME = "Priya Nair";
  await db.collection("users").doc(PRIYA_ID).set(
    {
      uid: PRIYA_ID,
      email: "priya.nair@myibu.ca",
      displayName: PRIYA_NAME,
      initials: "PN",
      role: "advisor",
      title: "Student Success Advisor",
    },
    { merge: true },
  );
  console.log(`  staff roster: ${ADVISOR_NAME}, ${PRIYA_NAME}`);

  // ---- board tickets (varied students/owners/statuses; some unassigned "new" backlog) ----
  const boardTickets = [
    { id: "seed-req-2052", code: "REQ-2052", title: "MSc Applied AI course conflict", category: "advising", priority: "high", status: "new", ownerId: null, ownerName: null, student: "Ade Balogun", nextAction: null, ageHours: 3 },
    { id: "seed-req-2055", code: "REQ-2055", title: "Co-op placement inquiry", category: "career", priority: "low", status: "new", ownerId: null, ownerName: null, student: "Lin Zhao", nextAction: null, ageHours: 8 },
    { id: "seed-req-2031", code: "REQ-2031", title: "Portal login / access issue", category: "it", priority: "medium", status: "assigned", ownerId: advisorId, ownerName: ADVISOR_NAME, student: "Marco Rossi", nextAction: "Reset SSO, confirm", ageHours: 6 },
    { id: "seed-req-2036", code: "REQ-2036", title: "Transcript request", category: "records", priority: "medium", status: "assigned", ownerId: PRIYA_ID, ownerName: PRIYA_NAME, student: "Sara Kim", nextAction: "Verify student ID", ageHours: 26 },
  ];
  for (const t of boardTickets) {
    await db.collection("tickets").doc(t.id).set({
      code: t.code,
      title: t.title,
      description: `Seeded sample: ${t.title}.`,
      category: t.category,
      priority: t.priority,
      status: t.status,
      studentId: `seed-student-${t.id}`,
      studentName: t.student,
      assigneeId: t.ownerId,
      assigneeName: t.ownerName,
      createdAt: ts(-t.ageHours * HOUR - DAY),
      updatedAt: ts(-t.ageHours * HOUR),
      lastActorName: t.ownerName ?? t.student,
      lastMessageAt: ts(-t.ageHours * HOUR),
      resolvedAt: null,
      nextAction: t.nextAction,
      rating: null,
    });
    console.log(`  board ticket ${t.code} (${t.status}${t.ownerId ? "" : ", unassigned"})`);
  }

  // ---- give the mockup ticket (REQ-2041) a nextAction + a full event trail so the staff
  //      detail timeline (request → claimed → internal note → reply) is populated ----
  await db.collection("tickets").doc("seed-req-2041").set(
    { nextAction: "Confirm hold with Records" },
    { merge: true },
  );
  const req41Events = [
    { id: "ev1", type: "created", visibility: "public", fromStatus: null, toStatus: "new", actorId: student.uid, actorName: STUDENT_NAME, actorRole: "student", message: "", fromNow: -3 * DAY },
    { id: "ev2", type: "claimed", visibility: "public", fromStatus: "new", toStatus: "assigned", actorId: advisorId, actorName: ADVISOR_NAME, actorRole: "advisor", message: "", fromNow: -3 * DAY + 2 * HOUR },
    { id: "ev3", type: "internal_note", visibility: "internal", fromStatus: null, toStatus: null, actorId: advisorId, actorName: ADVISOR_NAME, actorRole: "advisor", message: "Checked SIS — hold is a missing emergency-contact field, not financial. Quick fix once the student updates their profile.", fromNow: -3 * DAY + 3 * HOUR },
    { id: "ev4", type: "message", visibility: "public", fromStatus: "assigned", toStatus: "waiting_for_student", actorId: advisorId, actorName: ADVISOR_NAME, actorRole: "advisor", message: "Hi — good news, this is just a missing emergency contact on your profile, not a financial hold. Please add one under Profile → Contacts and reply here; I'll clear the hold right after.", fromNow: -2 * HOUR },
  ];
  for (const e of req41Events) {
    await db.collection("tickets").doc("seed-req-2041").collection("events").doc(e.id).set({
      type: e.type,
      visibility: e.visibility,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actorId: e.actorId,
      actorName: e.actorName,
      actorRole: e.actorRole,
      message: e.message,
      createdAt: ts(e.fromNow),
    });
  }
  console.log("  events on REQ-2041 (created → claimed → internal note → reply)");

  // ---- a completed advising appointment (so the advisor schedule shows a "Completed" card) ----
  const doneStart = atClock(-7, 15);
  await db.collection("appointments").doc("seed-apt-2030").set({
    code: "APT-2030",
    service: "academic_advising",
    title: "Academic planning session",
    studentId: student.uid,
    studentName: STUDENT_NAME,
    advisorId,
    advisorName: ADVISOR_NAME,
    start: doneStart,
    end: Timestamp.fromMillis(doneStart.toMillis() + 45 * 60 * 1000),
    mode: "video",
    location: "Join by video",
    status: "completed",
    notes: "",
    createdAt: ts(-9 * DAY),
  });
  console.log("  appointment APT-2030 (completed)");

  // ==========================================================================
  // US-08 reporting history — a batch of tickets spread across ~8 weeks with
  // varied categories/statuses + seeded ratings, so the admin charts (requests
  // over time, status donut, category bars, satisfaction trend) have real shape.
  // Deterministic (index-derived, no randomness) so re-runs are idempotent.
  // ==========================================================================
  const HIST_CATEGORIES = ["registration", "advising", "records", "financial_aid", "it", "career"];
  const HIST_TITLES: Record<string, string> = {
    registration: "Course registration question",
    advising: "Advising plan review",
    records: "Records / transcript request",
    financial_aid: "Financial aid enquiry",
    it: "Portal access issue",
    career: "Career services question",
  };
  const HIST_OWNERS = [
    { id: advisorId, name: ADVISOR_NAME },
    { id: PRIYA_ID, name: PRIYA_NAME },
    { id: null as string | null, name: null as string | null },
  ];
  const HIST_RATINGS = [5, 4, 4, 5, 3, 4, 5, 4];
  const HIST_COUNT = 48;

  for (let i = 0; i < HIST_COUNT; i++) {
    const category = HIST_CATEGORIES[i % HIST_CATEGORIES.length]!;
    const daysAgo = Math.floor((i * 56) / HIST_COUNT); // spread 0..~55 days
    const createdMs = -daysAgo * DAY - 6 * HOUR;
    // ~70% resolved/closed (rated), ~30% still open across the lifecycle
    const openBucket = i % 10 < 3;
    const status = openBucket
      ? (["new", "assigned", "waiting_for_student"] as const)[i % 3]!
      : i % 2 === 0
        ? "resolved"
        : "closed";
    const done = status === "resolved" || status === "closed";
    const owner = status === "new" ? HIST_OWNERS[2]! : HIST_OWNERS[i % 2]!;
    const resolveDays = 1 + (i % 4); // 1..4 days to resolve
    const priority = (["high", "medium", "low"] as const)[i % 3]!;
    const id = `seed-hist-${String(i).padStart(2, "0")}`;

    await db.collection("tickets").doc(id).set({
      code: `REQ-H${String(i).padStart(3, "0")}`,
      title: HIST_TITLES[category]!,
      description: `Seeded reporting sample (${category}).`,
      category,
      priority,
      status,
      studentId: `seed-hist-student-${i}`,
      studentName: `Student ${i + 1}`,
      assigneeId: owner.id,
      assigneeName: owner.name,
      createdAt: ts(createdMs),
      updatedAt: ts(createdMs + resolveDays * DAY),
      lastActorName: owner.name ?? `Student ${i + 1}`,
      lastMessageAt: ts(createdMs + resolveDays * DAY),
      resolvedAt: done ? ts(createdMs + resolveDays * DAY) : null,
      nextAction: null,
      rating: done ? HIST_RATINGS[i % HIST_RATINGS.length]! : null,
    });
  }
  console.log(`  reporting history: ${HIST_COUNT} tickets across ~8 weeks (seeded ratings)`);

  console.log("\nDone. Sign in as", STUDENT_EMAIL, "or", ADVISOR_EMAIL, "or", ADMIN_EMAIL, "to see the populated views.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
