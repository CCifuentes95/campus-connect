// Small date/time formatters for dashboard cards. Pure functions over epoch millis so they
// work with the serialized values the data layer returns. Safe to import from client or server.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now" / "5m ago" / "3h ago" / "2d ago" / a short date for older items. */
export function relativeTime(ms: number | null, now: number = Date.now()): string {
  if (!ms) return "—";
  const diff = Math.max(0, now - ms);
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Deterministic month abbreviations so date stamps don't vary by locale (matches clockTime's
// intent — avoids hydration drift; rendered server-side on the Track Ticket detail).
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** "Jul 18" — short month + day, deterministic. */
export function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "Jul 18, 9:12 AM" — timeline event stamp. */
export function timelineStamp(ms: number): string {
  return `${shortDate(ms)}, ${clockTime(ms)}`;
}

/** "Jul 18, 2026 · 9:12 AM" — the sidebar "Created" row. */
export function longDateTime(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${clockTime(ms)}`;
}

export interface DateTile {
  month: string; // "JUL"
  day: string; // "24"
  weekday: string; // "Thu"
}

/** The navy date-tile parts (month/day/weekday) for an appointment card. */
export function dateTile(ms: number): DateTile {
  const d = new Date(ms);
  return {
    month: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
  };
}

/** "9:30 AM" for an appointment time. Deterministic (not locale-dependent) so server- and
 * client-rendered times agree — avoids hydration mismatch and matches the design's "AM". */
export function clockTime(ms: number): string {
  const d = new Date(ms);
  const minutes = d.getMinutes();
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  let hour = d.getHours() % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

/** First name for the greeting hero; falls back to the whole string / a default. */
export function firstName(name: string | null | undefined, fallback = "there"): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\s+/)[0]!;
}
