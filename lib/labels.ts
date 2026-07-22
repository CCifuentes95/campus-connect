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
