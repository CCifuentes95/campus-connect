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

/** "9:30 AM" for an appointment start. */
export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** First name for the greeting hero; falls back to the whole string / a default. */
export function firstName(name: string | null | undefined, fallback = "there"): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\s+/)[0]!;
}
