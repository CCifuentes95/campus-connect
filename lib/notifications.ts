// Static notification config: type enum, tile styling, and the preferences matrix shape.
// Pure and framework-agnostic — imported from server actions, data reads, and client UI.
// The `notifications` subcollection and `users.notificationPrefs` are documented in
// docs/data-model.md; the closed `type` enum below must match firestore.rules exactly.

export const NOTIFICATION_TYPES = [
  "ticket_update",
  "ticket_reply",
  "appointment_booked",
  "appointment_reminder",
  "appointment_cancelled",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Tile color + icon kind for the Inbox row (design-brief: ticket = teal, appointment = navy). */
export type NotificationTileKind = "ticket" | "appointment";

const TILE_KIND: Record<NotificationType, NotificationTileKind> = {
  ticket_update: "ticket",
  ticket_reply: "ticket",
  appointment_booked: "appointment",
  appointment_reminder: "appointment",
  appointment_cancelled: "appointment",
};

export function notificationTileKind(type: string): NotificationTileKind {
  return TILE_KIND[type as NotificationType] ?? "ticket";
}

/** Current epoch millis — wrapped so server components can read "now" without the
 * react-hooks/purity lint tripping on a bare Date.now() in render (matches lib/advising.ts). */
export function nowMs(): number {
  return Date.now();
}

// ---- Preferences matrix (US-06) ----
// Design brief: Ticket updates / Appointment reminders / Advisor messages / Announcements
// rows x Email / Push / In-app columns. "Push" replaces the mockup's "SMS" per the
// already-recorded stack deviation (FCM, not SMS). Only In-app is functionally wired to a
// real send in this change — Email/Push are saved but not yet delivered (see design.md).
export const PREF_CHANNELS = ["email", "push", "inApp"] as const;
export type PrefChannel = (typeof PREF_CHANNELS)[number];

export const PREF_ROWS = [
  {
    key: "ticketUpdates",
    label: "Ticket updates",
    desc: "Status changes and replies on your support requests.",
    essential: true,
  },
  {
    key: "appointmentReminders",
    label: "Appointment reminders",
    desc: "Upcoming and rescheduled advising sessions.",
    essential: false,
  },
  {
    key: "advisorMessages",
    label: "Advisor messages",
    desc: "Direct messages from your advisor or support staff.",
    essential: false,
  },
  {
    key: "announcements",
    label: "Announcements",
    desc: "Campus, program, and deadline news. Optional.",
    essential: false,
  },
] as const;

export type PrefRowKey = (typeof PREF_ROWS)[number]["key"];

export type NotificationPrefs = Record<PrefRowKey, Record<PrefChannel, boolean>>;

/** Defaults for a student with no saved preferences yet (mirrors the mockup's initial state). */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  ticketUpdates: { email: true, push: false, inApp: true },
  appointmentReminders: { email: true, push: true, inApp: true },
  advisorMessages: { email: true, push: false, inApp: true },
  announcements: { email: false, push: false, inApp: true },
};

/** Merge a (possibly partial/legacy) stored prefs value over the defaults. */
export function normalizePrefs(stored: unknown): NotificationPrefs {
  const source =
    stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const result = {} as NotificationPrefs;
  for (const row of PREF_ROWS) {
    const storedRow =
      source[row.key] && typeof source[row.key] === "object"
        ? (source[row.key] as Record<string, unknown>)
        : {};
    result[row.key] = {
      email: Boolean(storedRow.email ?? DEFAULT_NOTIFICATION_PREFS[row.key].email),
      push: Boolean(storedRow.push ?? DEFAULT_NOTIFICATION_PREFS[row.key].push),
      inApp: Boolean(storedRow.inApp ?? DEFAULT_NOTIFICATION_PREFS[row.key].inApp),
    };
  }
  return result;
}

/** Form field name for one row/channel toggle. */
export function prefFieldName(row: PrefRowKey, channel: PrefChannel): string {
  return `${row}_${channel}`;
}

/** "Mute all non-essential" preset — mirrors the mockup: keeps the essential row (ticket
 * updates) fully on, plus keeps email for appointment reminders (per the design brief's
 * "essential updates ... always sent by email" banner), clears everything else. */
export function muteNonEssential(prefs: NotificationPrefs): NotificationPrefs {
  const next = { ...prefs, ticketUpdates: { ...prefs.ticketUpdates } };
  for (const row of PREF_ROWS) {
    if (row.key === "ticketUpdates") continue;
    next[row.key] = {
      email: row.key === "appointmentReminders" ? prefs[row.key].email : false,
      push: false,
      inApp: false,
    };
  }
  return next;
}
