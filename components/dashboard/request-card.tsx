import Link from "next/link";
import type { DashboardTicket } from "@/lib/data/student-dashboard";
import { relativeTime } from "@/lib/format";
import { categoryLabel, priorityStyle, studentStatusLabel } from "@/lib/labels";

// Small status glyph, keyed on the canonical status (matches the design mockup).
function StatusIcon({ status }: { status: string }) {
  const c = {
    "aria-hidden": true,
    width: 13,
    height: 13,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (status === "waiting_for_student")
    return (
      <svg {...c}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  if (status === "resolved" || status === "closed")
    return (
      <svg {...c} strokeWidth={2.2}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  if (status === "assigned")
    return (
      <svg {...c}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  return <span aria-hidden="true" className="inline-block h-[7px] w-[7px] rounded-full bg-current" />;
}

// A support-request card (dashboard Lane A + reused by the Requests list in US-05). The card
// body is a div; only "Open →" navigates (matches the design and keeps anchors un-nested).
export function RequestCard({ ticket }: { ticket: DashboardTicket }) {
  const priority = priorityStyle(ticket.priority);

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_1px_2px_var(--card-shadow)] transition-shadow hover:border-[color:var(--card-hover-border)] hover:shadow-[0_6px_20px_var(--card-hover-shadow)]">
      <div
        className="flex items-center justify-between gap-3 border-b border-divider px-5 py-[11px]"
        style={{ background: priority.tintVar }}
      >
        <span
          className="inline-flex items-center gap-[7px] text-[12.5px] font-bold uppercase tracking-[0.4px]"
          style={{ color: priority.colorVar }}
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ background: priority.colorVar }}
          />
          {priority.label} priority
        </span>
        <span className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-full bg-pill-bg px-3 py-[5px] text-[12px] font-semibold text-pill-text">
          <StatusIcon status={ticket.status} />
          {studentStatusLabel(ticket.status)}
        </span>
      </div>

      <div className="min-w-0 px-5 pb-[18px] pt-4">
        <h3 className="line-clamp-2 text-[16px] font-semibold leading-[1.35] text-ink">
          {ticket.title || "Untitled request"}
        </h3>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rounded-md bg-teal-tint px-[9px] py-[3px] text-[11px] font-semibold tracking-[0.2px] text-teal">
              {categoryLabel(ticket.category)}
            </span>
            <span className="truncate text-[12px] text-muted">
              <span translate="no">{ticket.code ? `#${ticket.code}` : "—"}</span> · Updated{" "}
              {relativeTime(ticket.updatedAtMs)}
            </span>
          </div>
          <Link
            href={`/requests/${ticket.id}`}
            className="whitespace-nowrap text-[13px] font-semibold text-ink hover:text-teal"
          >
            Open <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
