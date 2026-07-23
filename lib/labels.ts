// Display mappings for stored ticket/appointment enums. The stored value is canonical
// (docs/data-model.md); these render the audience-appropriate label. Student-facing here —
// staff labels live with the staff screens (US-07). Safe to import from client or server.

export type TicketStatus =
  | "new"
  | "assigned"
  | "waiting_for_student"
  | "resolved"
  | "closed";

export type Priority = "high" | "medium" | "low";

// Status → what the student sees (data-model.md status display table).
const STUDENT_STATUS_LABEL: Record<string, string> = {
  new: "New",
  assigned: "In progress",
  waiting_for_student: "Waiting for you",
  resolved: "Resolved",
  closed: "Closed",
};

export function studentStatusLabel(status: string): string {
  return STUDENT_STATUS_LABEL[status] ?? status;
}

/** A ticket counts as "open" for the dashboard badge until it is closed. */
export function isOpenStatus(status: string): boolean {
  return status !== "closed";
}

// ---- Track Ticket status pill + stepper (US-05) ----

/** Which glyph the status pill shows. The pill itself is always the neutral pill-bg/pill-text
 * (per the mockup); only the icon differs by status. The SVG lives in the pill component. */
export type StatusGlyph =
  | "new"
  | "assigned"
  | "waiting"
  | "resolved"
  | "closed";

const STATUS_GLYPH: Record<string, StatusGlyph> = {
  new: "new",
  assigned: "assigned",
  waiting_for_student: "waiting",
  resolved: "resolved",
  closed: "closed",
};

/** Student-facing status pill: the label ("In progress" for assigned, per data-model) plus the
 * glyph key. Mirrors `appointmentStatusStyle` but the pill tint is neutral for every status. */
export function studentStatusStyle(status: string): {
  label: string;
  glyph: StatusGlyph;
} {
  return {
    label: studentStatusLabel(status),
    glyph: STATUS_GLYPH[status] ?? "new",
  };
}

/** The five lifecycle stages, in order — the stepper's fixed process labels (distinct from the
 * status pill: `assigned`'s step reads "Assigned", its pill reads "In progress"). */
export const STATUS_STEPS: { status: TicketStatus; label: string }[] = [
  { status: "new", label: "New" },
  { status: "assigned", label: "Assigned" },
  { status: "waiting_for_student", label: "Waiting for you" },
  { status: "resolved", label: "Resolved" },
  { status: "closed", label: "Closed" },
];

export type StepState = "done" | "current" | "todo";

/**
 * The stepper's per-step state derived from the ticket's *stored* status — steps before the
 * current status are `done`, the current one `current`, later ones `todo`. Never fabricates a
 * status the ticket doesn't hold (no closed-on-read for aged resolved tickets). Unknown status
 * falls back to the first step being current.
 */
export function stepStates(
  status: string,
): { status: TicketStatus; label: string; state: StepState }[] {
  const idx = STATUS_STEPS.findIndex((s) => s.status === status);
  const current = idx === -1 ? 0 : idx;
  return STATUS_STEPS.map((s, i) => ({
    ...s,
    state: i < current ? "done" : i === current ? "current" : "todo",
  }));
}

// ---- Staff-facing labels (US-07 triage) ----
// The stored status/category is canonical; staff see a different label than students
// (data-model.md audience table). Kept separate from the student maps above.

const STAFF_STATUS_LABEL: Record<string, string> = {
  new: "New",
  assigned: "Assigned",
  waiting_for_student: "Waiting for student",
  resolved: "Resolved",
  closed: "Closed",
};

export function staffStatusLabel(status: string): string {
  return STAFF_STATUS_LABEL[status] ?? status;
}

const STAFF_CATEGORY_LABEL: Record<string, string> = {
  registration: "Academic",
  records: "Records",
  financial_aid: "Finance",
  advising: "Advising",
  enrollment: "Academic",
  it: "IT Support",
  career: "Career",
  other: "Other",
};

export function staffCategoryLabel(category: string): string {
  return STAFF_CATEGORY_LABEL[category] ?? category;
}

/** Named staff transitions available from a given status (drives the detail status-actions
 * panel and validates Kanban drops). `assign`/`reassign`/`unassign` are assignment-only and
 * handled separately; these are the status-changing actions. */
export type StaffAction =
  | "claim"
  | "request_info"
  | "mark_resolved"
  | "close"
  | "reopen";

const STAFF_ACTIONS_BY_STATUS: Record<string, StaffAction[]> = {
  new: ["claim"],
  assigned: ["mark_resolved", "request_info"],
  waiting_for_student: ["mark_resolved", "request_info"],
  resolved: ["close", "reopen"],
  closed: [],
};

export function staffActionsFor(status: string): StaffAction[] {
  return STAFF_ACTIONS_BY_STATUS[status] ?? [];
}

/** The four Kanban columns, in order (design-brief triage board). `closed` has no column —
 * closing happens from the detail panel, not the board. */
export const KANBAN_COLUMNS: { status: TicketStatus; label: string }[] = [
  { status: "new", label: "New" },
  { status: "assigned", label: "Assigned" },
  { status: "waiting_for_student", label: "Waiting for student" },
  { status: "resolved", label: "Resolved" },
];

// Category canonical → student label (data-model.md categories table).
const STUDENT_CATEGORY_LABEL: Record<string, string> = {
  registration: "Registration & holds",
  records: "Records & transcripts",
  financial_aid: "Financial aid",
  advising: "Advising & planning",
  enrollment: "Course & enrollment",
  it: "Technical support",
  career: "Career",
  other: "Other",
};

export function categoryLabel(category: string): string {
  return STUDENT_CATEGORY_LABEL[category] ?? category;
}

// The categories offered on the Submit Support Request form, in the mockup's order (canonical
// value → student label). `career` is a valid stored category but isn't offered on this form.
export const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "registration", label: "Registration & holds" },
  { value: "records", label: "Records & transcripts" },
  { value: "financial_aid", label: "Financial aid" },
  { value: "advising", label: "Advising & planning" },
  { value: "enrollment", label: "Course & enrollment" },
  { value: "it", label: "Technical support" },
  { value: "other", label: "Other" },
];

/** Canonical category values accepted by the create form (for zod validation). */
export const CATEGORY_VALUES = CATEGORY_OPTIONS.map((o) => o.value) as [
  string,
  ...string[],
];

/** Priority values low → high (segmented control order + zod validation). */
export const PRIORITY_VALUES = ["low", "medium", "high"] as const;

// ---- Requests-list filter tabs (design mockup semantics) ----
export type RequestFilter = "all" | "open" | "waiting" | "resolved";

/**
 * Whether a ticket belongs in a filter tab. "Open" is the list's in-flight sense
 * (new/assigned/waiting) — distinct from the dashboard "N open" badge (`isOpenStatus`, which
 * counts every non-closed ticket). "Resolved" groups the done statuses (resolved + closed).
 */
export function matchesFilter(status: string, filter: RequestFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "open":
      return (
        status === "new" ||
        status === "assigned" ||
        status === "waiting_for_student"
      );
    case "waiting":
      return status === "waiting_for_student";
    case "resolved":
      return status === "resolved" || status === "closed";
  }
}

/** Sort weight for priority (high first). */
export const PRIORITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// Advising service canonical → label (design-brief booking flow).
const SERVICE_LABEL: Record<string, string> = {
  academic_advising: "Academic advising",
  financial_aid: "Financial aid",
  career: "Career services",
  registration: "Registration support",
};

export function serviceLabel(service: string): string {
  return SERVICE_LABEL[service] ?? service;
}

// Appointment status → badge label + color/tint var refs (theme-aware, like priorityStyle).
export function appointmentStatusStyle(status: string): {
  label: string;
  colorVar: string;
  tintVar: string;
} {
  switch (status) {
    case "booked":
      return { label: "Booked", colorVar: "var(--booked)", tintVar: "var(--booked-bg)" };
    case "completed":
      return { label: "Completed", colorVar: "var(--ok)", tintVar: "var(--ok-bg)" };
    case "cancelled":
      return { label: "Cancelled", colorVar: "var(--cancel)", tintVar: "var(--cancel-bg)" };
    default:
      return { label: status || "—", colorVar: "var(--muted)", tintVar: "var(--inset)" };
  }
}

// Priority → label + the CSS custom properties for its color + tinted background. Returning
// var() refs (not hex) lets the priority chips flip with the theme (see globals.css --pri-*).
export interface PriorityStyle {
  label: string;
  colorVar: string;
  tintVar: string;
}

const PRIORITY_STYLE: Record<string, PriorityStyle> = {
  high: { label: "High", colorVar: "var(--pri-high)", tintVar: "var(--pri-high-bg)" },
  medium: { label: "Medium", colorVar: "var(--pri-med)", tintVar: "var(--pri-med-bg)" },
  low: { label: "Low", colorVar: "var(--pri-low)", tintVar: "var(--pri-low-bg)" },
};

export function priorityStyle(priority: string): PriorityStyle {
  return (
    PRIORITY_STYLE[priority] ?? {
      label: priority || "—",
      colorVar: "var(--muted)",
      tintVar: "var(--inset)",
    }
  );
}
