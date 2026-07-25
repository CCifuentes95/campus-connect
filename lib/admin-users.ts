// Shared vocabulary for the admin People & access screens. Safe to import from client OR
// server (no server-only deps).
//
// The UI shows FOUR roles; the custom claim only has THREE. Advisor and Staff are the same
// `advisor` claim, split for display by the `staffType` profile field — so `isStaff()` in
// firestore.rules and the `Role` type in lib/roles.ts stay untouched. See ADR-0007.

import type { Role } from "@/lib/roles";

export const UI_ROLES = ["student", "advisor", "staff", "admin"] as const;
export type UiRole = (typeof UI_ROLES)[number];

/** Roles offerable at creation. Admin is deliberately absent — promote an existing account. */
export const CREATABLE_UI_ROLES = ["student", "advisor", "staff"] as const;

/** Verbatim from the mockups — deliberately NOT the ticket `category` enum (ADR-0007). */
export const CATEGORIES = [
  "Advising",
  "Academic",
  "Records",
  "Finance",
  "IT Support",
  "Career",
] as const;

export const PROGRAMS = [
  "MSc International Business",
  "MSc Applied AI",
  "MBA",
  "BCOM Business Administration",
  "BSc Economics",
] as const;

export const DEPARTMENTS = [
  "Advising",
  "Records & Finance",
  "IT Support",
  "Careers",
  "Program office",
] as const;

export const COHORTS = ["2026 Autumn", "2027 Spring", "2027 Autumn"] as const;

/** A user row as rendered by the roster and detail screens. */
export interface AdminUser {
  id: string;
  uiRole: UiRole;
  displayName: string;
  email: string;
  initials: string;
  program: string;
  cohort: string;
  studentId: string;
  dept: string;
  title: string;
  cats: string[];
  bookable: boolean;
  createdAtMs: number | null;
}

/** Claim + display-only staffType -> the four-way UI role. */
export function toUiRole(role: Role | string, staffType: unknown): UiRole {
  if (role === "admin") return "admin";
  if (role === "advisor") return staffType === "staff" ? "staff" : "advisor";
  return "student";
}

/** The inverse: UI role -> authoritative claim. Advisor and Staff collapse to `advisor`. */
export function toClaimRole(uiRole: UiRole): Role {
  if (uiRole === "admin") return "admin";
  if (uiRole === "advisor" || uiRole === "staff") return "advisor";
  return "student";
}

export function isUiRole(value: unknown): value is UiRole {
  return UI_ROLES.includes(value as UiRole);
}

export const UI_ROLE_LABEL: Record<UiRole, string> = {
  student: "Student",
  advisor: "Advisor",
  staff: "Staff",
  admin: "Admin",
};

/** Role pill tints. Values map onto tokens already in globals.css — see ADR-0007. */
export const UI_ROLE_PILL: Record<UiRole, string> = {
  student: "bg-teal-tint text-teal",
  advisor: "bg-[var(--pri-med-bg)] text-[var(--pri-med)]",
  staff: "bg-pill-bg text-pill-text",
  admin: "bg-[var(--pri-low-bg)] text-[var(--pri-low)]",
};

/** Sort order for the Role column — matches the mockup's ROLE_ORDER. */
export const UI_ROLE_ORDER: Record<UiRole, number> = {
  admin: 0,
  advisor: 1,
  staff: 2,
  student: 3,
};

export const ROLE_CARDS: {
  value: UiRole;
  label: string;
  icon: "cap" | "compass" | "brief" | "shield";
  blurb: string;
}[] = [
  {
    value: "student",
    label: "Student",
    icon: "cap",
    blurb: "Submits requests, books advising",
  },
  {
    value: "advisor",
    label: "Advisor",
    icon: "compass",
    blurb: "Advises students, takes advising tickets",
  },
  {
    value: "staff",
    label: "Staff",
    icon: "brief",
    blurb: "Handles support queues (records, IT, finance)",
  },
  {
    value: "admin",
    label: "Admin",
    icon: "shield",
    blurb: "Everything staff can reach, plus reports and accounts",
  },
];

export function permissionNote(uiRole: UiRole): string {
  if (uiRole === "student") return "Student portal access only.";
  if (uiRole === "advisor") return "Gets triage board + advising calendar.";
  if (uiRole === "admin") return "Full access, including reports and account management.";
  return "Gets triage board for the chosen categories.";
}

export function staffSectionLabel(uiRole: UiRole): string {
  if (uiRole === "advisor") return "Advisor profile";
  if (uiRole === "admin") return "Administrator profile";
  return "Staff profile";
}

export function titlePlaceholder(uiRole: UiRole): string {
  return uiRole === "advisor" ? "e.g. Programme advisor · MBA" : "e.g. Student records officer";
}

export const ACCESS_SUMMARY: Record<UiRole, string[]> = {
  student: [
    "Student dashboard and notifications",
    "Submit and track support requests",
    "Book advising appointments",
  ],
  advisor: [
    "Triage board for assigned categories",
    "Advising calendar and appointment detail",
    "Student request history",
  ],
  staff: [
    "Triage board for assigned categories",
    "Ticket detail and internal notes",
    "Request history for their queues",
  ],
  admin: [
    "Everything staff can reach",
    "Reports and insight dashboard",
    "Create, edit and delete accounts",
  ],
};

/** Defaults the mockup applies when the role selector changes. */
export function defaultsForRole(uiRole: UiRole): {
  program?: string;
  cohort?: string;
  dept?: string;
  cats?: string[];
} {
  if (uiRole === "student") return { program: PROGRAMS[0], cohort: COHORTS[0] };
  if (uiRole === "advisor") return { dept: "Advising", cats: ["Advising"] };
  if (uiRole === "admin") return { dept: "Program office", cats: [] };
  return { dept: "Records & Finance", cats: ["Records"] };
}

export function initialsFrom(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/** `Word-NNNN`, matching the mockup's generator. Callers are client-side event handlers. */
export function generatePassword(): string {
  const words = [
    "Campus",
    "Harbour",
    "Lantern",
    "Meridian",
    "Orchard",
    "Summit",
    "Cobalt",
    "Juniper",
  ];
  const word = words[Math.floor(Math.random() * words.length)]!;
  return `${word}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** "Program / department" column: programme for students, department for everyone else. */
export function unitOf(u: AdminUser): string {
  return u.uiRole === "student" ? u.program : u.dept;
}

export function unitNoteOf(u: AdminUser): string {
  if (u.uiRole === "student") {
    return [u.cohort, u.studentId && `ID ${u.studentId}`].filter(Boolean).join(" · ");
  }
  return u.title;
}
