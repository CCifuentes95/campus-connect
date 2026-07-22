// Static advising config + deterministic slot generation for US-04 booking. Seeded/simplified
// for the MVP — no `availability` collection. Pure and framework-agnostic (imported from both
// the client wizard and the server action, which re-runs it as the source of truth).
import { clockTime } from "@/lib/format";

export interface AdvisingService {
  value: string;
  label: string;
  durationMin: number;
}

// Canonical service value → label + duration (docs/design-brief.md Book Advising).
export const SERVICES: AdvisingService[] = [
  { value: "academic_advising", label: "Academic advising", durationMin: 45 },
  { value: "financial_aid", label: "Financial aid", durationMin: 30 },
  { value: "career", label: "Career services", durationMin: 45 },
  { value: "registration", label: "Registration support", durationMin: 30 },
];

export type AppointmentMode = "video" | "in_person" | "phone";

export interface Advisor {
  id: string;
  name: string;
  initials: string;
  focus: string;
  mode: AppointmentMode;
  location: string;
}

export const ADVISORS: Advisor[] = [
  {
    id: "priya-nair",
    name: "Priya Nair",
    initials: "PN",
    focus: "Academic advising · Postgraduate",
    mode: "video",
    location: "Microsoft Teams",
  },
  {
    id: "marcus-lee",
    name: "Marcus Lee",
    initials: "ML",
    focus: "Financial aid & scholarships",
    mode: "in_person",
    location: "Student Services, Room 214",
  },
  {
    id: "sofia-herrera",
    name: "Dr. Sofia Herrera",
    initials: "SH",
    focus: "Career services & internships",
    mode: "video",
    location: "Microsoft Teams",
  },
];

export const SERVICE_VALUES = SERVICES.map((s) => s.value) as [string, ...string[]];
export const ADVISOR_IDS = ADVISORS.map((a) => a.id) as [string, ...string[]];

export function serviceByValue(value: string): AdvisingService | undefined {
  return SERVICES.find((s) => s.value === value);
}
export function advisorById(id: string): Advisor | undefined {
  return ADVISORS.find((a) => a.id === id);
}

/** How the appointment's format reads on cards/detail. */
export function modeLabel(mode: string, location: string): string {
  if (mode === "video") return `Video call · ${location}`;
  if (mode === "phone") return "Phone call";
  return location;
}
/** Short format label for list cards (e.g. "Video call" / "Room 214"). */
export function modeShort(mode: string, location: string): string {
  if (mode === "video") return "Video call";
  if (mode === "phone") return "Phone call";
  return location;
}

// Working hours: weekday morning + afternoon blocks, 30-minute grid of slot starts.
const MORNING_STARTS = [9 * 60, 9 * 60 + 30, 10 * 60, 10 * 60 + 30, 11 * 60, 11 * 60 + 30];
const AFTERNOON_STARTS = [13 * 60, 13 * 60 + 30, 14 * 60, 14 * 60 + 30, 15 * 60, 15 * 60 + 30];

export interface Slot {
  startMs: number;
  endMs: number;
  label: string;
  available: boolean;
}

export interface ExistingSpan {
  startMs: number;
  endMs: number;
}

/** Half-open interval overlap. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function isWeekend(dateMs: number): boolean {
  const d = new Date(dateMs).getDay();
  return d === 0 || d === 6;
}

function slotStart(dateMs: number, minutesOfDay: number): number {
  const d = new Date(dateMs);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    Math.floor(minutesOfDay / 60),
    minutesOfDay % 60,
    0,
    0,
  ).getTime();
}

function buildSlots(
  starts: number[],
  dateMs: number,
  durationMin: number,
  existing: ExistingSpan[],
  nowMs: number,
): Slot[] {
  const weekend = isWeekend(dateMs);
  return starts.map((m) => {
    const startMs = slotStart(dateMs, m);
    const endMs = startMs + durationMin * 60_000;
    const available =
      !weekend &&
      startMs > nowMs &&
      !existing.some((e) => overlaps(startMs, endMs, e.startMs, e.endMs));
    return { startMs, endMs, label: clockTime(startMs), available };
  });
}

/** Generate the morning + afternoon slot grids for a service on a given day. */
export function generateSlots(
  serviceValue: string,
  dateMs: number,
  existing: ExistingSpan[],
  nowMs: number,
): { morning: Slot[]; afternoon: Slot[] } {
  const service = serviceByValue(serviceValue);
  const duration = service?.durationMin ?? 30;
  return {
    morning: buildSlots(MORNING_STARTS, dateMs, duration, existing, nowMs),
    afternoon: buildSlots(AFTERNOON_STARTS, dateMs, duration, existing, nowMs),
  };
}

/** True when `startMs` is a real, currently-available slot for this service/day. */
export function isValidSlot(
  serviceValue: string,
  startMs: number,
  existing: ExistingSpan[],
  nowMs: number,
): boolean {
  const { morning, afternoon } = generateSlots(serviceValue, startMs, existing, nowMs);
  return [...morning, ...afternoon].some((s) => s.startMs === startMs && s.available);
}

/** Current epoch millis — wrapped so server components can read "now" without the
 * react-hooks/purity lint tripping on a bare Date.now() in render. */
export function nowMs(): number {
  return Date.now();
}

export interface DateChip {
  ms: number;
  weekday: string;
  day: string;
  month: string;
}

/** The next `count` weekdays (business days) from `fromMs`, for the date strip. */
export function upcomingBusinessDays(count: number, fromMs: number): DateChip[] {
  const out: DateChip[] = [];
  const d = new Date(fromMs);
  d.setHours(0, 0, 0, 0);
  while (out.length < count) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      out.push({
        ms: d.getTime(),
        weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
        day: String(d.getDate()),
        month: d.toLocaleDateString(undefined, { month: "short" }),
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}
