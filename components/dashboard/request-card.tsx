import Link from "next/link";
import type { DashboardTicket } from "@/lib/data/student-dashboard";
import { relativeTime } from "@/lib/format";
import { categoryLabel, priorityStyle, studentStatusLabel } from "@/lib/labels";

// A single support-request card (dashboard Lane A + reused by the Requests list in US-05).
// Priority-tinted header, student-facing status pill, category chip, #REQ code, updated time.
export function RequestCard({ ticket }: { ticket: DashboardTicket }) {
  const priority = priorityStyle(ticket.priority);

  return (
    <Link
      href={`/requests/${ticket.id}`}
      className="block overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_1px_2px_rgba(13,44,73,0.04)] transition-shadow hover:shadow-[0_4px_12px_rgba(13,44,73,0.08)]"
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: priority.bg }}
      >
        <span
          className="text-[12px] font-semibold uppercase tracking-wide"
          style={{ color: priority.text }}
        >
          {priority.label} priority
        </span>
        <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[12px] font-semibold text-navy">
          {studentStatusLabel(ticket.status)}
        </span>
      </div>

      <div className="px-4 py-3.5">
        <h3 className="mb-2 text-[15px] font-semibold leading-snug text-ink">
          {ticket.title || "Untitled request"}
        </h3>
        <div className="mb-3 inline-block rounded-md bg-inset px-2.5 py-1 text-[12px] font-medium text-body">
          {categoryLabel(ticket.category)}
        </div>
        <div className="flex items-center justify-between text-[12px] text-muted">
          <span className="font-mono">
            {ticket.code ? `#${ticket.code}` : "—"}
          </span>
          <span>Updated {relativeTime(ticket.updatedAtMs)}</span>
        </div>
      </div>
    </Link>
  );
}
