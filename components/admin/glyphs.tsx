// Icon helpers for the admin People & access screens. Client-safe (no server deps).
// Glyphs match the Users / User Detail mockups exactly.

const strokeProps = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export type RoleIcon = "cap" | "compass" | "brief" | "shield";

/** Role glyphs: graduation cap / compass / briefcase / shield. */
export function RoleGlyph({ icon, size = 16 }: { icon: RoleIcon; size?: number }) {
  const p = { "aria-hidden": true, width: size, height: size, viewBox: "0 0 24 24", strokeWidth: 2, ...strokeProps };
  if (icon === "cap")
    return (
      <svg {...p}>
        <path d="M22 10 12 5 2 10l10 5 10-5z" />
        <path d="M6 12.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
      </svg>
    );
  if (icon === "compass")
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    );
  if (icon === "shield")
    return (
      <svg {...p}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  return (
    <svg {...p}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export function CheckGlyph({ size = 13, strokeWidth = 3 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" strokeWidth={strokeWidth} {...strokeProps} className="shrink-0">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Show/hide password eye. `off` renders the struck-through variant (password visible). */
export function EyeGlyph({ off, size = 15 }: { off: boolean; size?: number }) {
  const p = { "aria-hidden": true, width: size, height: size, viewBox: "0 0 24 24", strokeWidth: 2, ...strokeProps };
  if (off)
    return (
      <svg {...p}>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  return (
    <svg {...p}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function RefreshGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} {...strokeProps}>
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

export function TrashGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} {...strokeProps}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

export function WarnGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.2} {...strokeProps} className="shrink-0">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function DangerGlyph({ size = 21 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} {...strokeProps}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function PersonPlusGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.2} {...strokeProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

export function SaveGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.4} {...strokeProps}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

export function ChevronGlyph({ size = 14, dir = "down" }: { size?: number; dir?: "down" | "right" }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} {...strokeProps}>
      {dir === "down" ? <polyline points="6 9 12 15 18 9" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
  );
}

export function ArrowLeftGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.2} {...strokeProps}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function SortGlyph({ dir }: { dir: "asc" | "desc" }) {
  return (
    <svg aria-hidden width={11} height={11} viewBox="0 0 24 24" strokeWidth={3} {...strokeProps}>
      {dir === "asc" ? <polyline points="6 15 12 9 18 15" /> : <polyline points="6 9 12 15 18 9" />}
    </svg>
  );
}
