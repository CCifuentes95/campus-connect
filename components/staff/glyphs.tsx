// Small, pure icon helpers shared across the staff triage screens. Client-safe (no server
// deps). Glyphs match the Triage Board / Staff Ticket Detail mockups exactly.

const strokeProps = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** The status pill's leading glyph (staff view). Neutral pill tint; only the icon changes. */
export function StatusGlyph({ status, size = 13 }: { status: string; size?: number }) {
  const p = { "aria-hidden": true, width: size, height: size, viewBox: "0 0 24 24", strokeWidth: 2, ...strokeProps };
  if (status === "waiting_for_student")
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  if (status === "resolved" || status === "closed")
    return (
      <svg {...p} strokeWidth={2.4}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  if (status === "assigned")
    return (
      <svg {...p}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  // new
  return (
    <span
      aria-hidden="true"
      style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }}
    />
  );
}

/** A filled dot in the priority's color (for the Priority cell). */
export function PriorityDot({ colorVar, size = 8 }: { colorVar: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: "50%", background: colorVar, display: "inline-block" }}
    />
  );
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
