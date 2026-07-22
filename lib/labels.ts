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

// Priority → label + brand colors (design-brief priority colors: High red, Medium amber,
// Low green). `text`/`bg` are the pill ink and its tinted chip background.
export interface PriorityStyle {
  label: string;
  text: string;
  bg: string;
}

const PRIORITY_STYLE: Record<string, PriorityStyle> = {
  high: { label: "High", text: "#c0392b", bg: "#fbeae8" },
  medium: { label: "Medium", text: "#c98a12", bg: "#fbf1de" },
  low: { label: "Low", text: "#4a7a54", bg: "#e9f2ec" },
};

export function priorityStyle(priority: string): PriorityStyle {
  return (
    PRIORITY_STYLE[priority] ?? { label: priority || "—", text: "#4a5b6b", bg: "#eef2f6" }
  );
}
