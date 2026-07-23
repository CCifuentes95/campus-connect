import "server-only";

// Feature flags — a lightweight, server-only config-flag layer (no external SaaS; see the ADR
// "config flags vs LaunchDarkly"). Each flag is backed by a plain, non-`NEXT_PUBLIC_*` env var
// so its value is read only on the server and never inlined into the client bundle. Flags
// **default ON**: absent or malformed config never disables a shipped feature — turning a flow
// off is a deliberate act (set the var to a recognised falsey value). To toggle a flow in
// production, set its var in Vercel and redeploy. If runtime toggling is ever needed, swap the
// source inside `isEnabled` for a cached Firestore `config` read — no call-site changes.

/** The flag registry: stable flag name → its backing environment variable. */
export const FLAGS = {
  "submit-request": "FLAG_SUBMIT_REQUEST",
  "book-appointment": "FLAG_BOOK_APPOINTMENT",
  notifications: "FLAG_NOTIFICATIONS",
  "staff-triage": "FLAG_STAFF_TRIAGE",
} as const;

/** A valid flag name — referencing anything else is a compile error. */
export type FlagName = keyof typeof FLAGS;

/** Recognised "off" values (case-insensitive, trimmed). Anything else — including unset,
 * empty, or a typo — reads as ON (safe default). Kept in sync with scripts/check-flags.mjs. */
const FALSEY = new Set(["off", "false", "0", "no"]);

/** Pure predicate over a raw env value: safe-default-on. Exported for the regression check. */
export function flagEnabled(raw: string | undefined | null): boolean {
  if (raw == null) return true;
  return !FALSEY.has(raw.trim().toLowerCase());
}

/** Whether a feature flag is on. Server-only; reads its backing env var. */
export function isEnabled(name: FlagName): boolean {
  return flagEnabled(process.env[FLAGS[name]]);
}
