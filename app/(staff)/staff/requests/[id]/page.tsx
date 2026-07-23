import type { Metadata } from "next";
import Link from "next/link";
import { StaffTicketWorkspace } from "@/components/staff/staff-ticket-workspace";
import { StatusGlyph, initialsOf } from "@/components/staff/glyphs";
import { getSessionUser } from "@/lib/firebase/session";
import { getStaffRoster } from "@/lib/data/staff";
import { getStaffTicketDetail } from "@/lib/data/staff-tickets";
import { longDateTime } from "@/lib/format";
import { priorityStyle, staffCategoryLabel, staffStatusLabel } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Request · Triage · CampusConnect",
};

export default async function StaffTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, user, roster] = await Promise.all([
    getStaffTicketDetail(id),
    getSessionUser(),
    getStaffRoster(),
  ]);

  if (result.kind === "error") {
    return <CenteredCard title="We couldn't load this request" body="Something went wrong. Please refresh — if it keeps happening, try again shortly." />;
  }
  if (result.kind === "not_found") {
    return <CenteredCard title="Request not found" body="This request doesn't exist or is no longer available." />;
  }

  const { ticket, events } = result;
  const meUid = user?.uid ?? "";
  const pri = priorityStyle(ticket.priority);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-8 pb-16 pt-5">
      <Link href="/staff/triage" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-muted-2 hover:text-ink">
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        Back to triage board
      </Link>

      {/* HEADER CARD */}
      <div className="mb-[22px] rounded-2xl border border-line bg-card px-[26px] py-[22px] shadow-[0_1px_2px_var(--card-shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-[18px]">
          <div>
            <div className="mb-[9px] flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-[13px] text-muted" translate="no">{ticket.code}</span>
              <span className="inline-flex items-center gap-[7px] text-[12px] font-bold uppercase tracking-[0.4px]" style={{ color: pri.colorVar }}>
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: pri.colorVar }} />
                {pri.label} priority
              </span>
              <span className="rounded-md bg-teal-tint px-2.5 py-[3px] text-[12px] font-semibold text-teal">{staffCategoryLabel(ticket.category)}</span>
            </div>
            <h1 className="mb-3 text-[24px] font-bold leading-[1.25] text-ink">{ticket.title}</h1>
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-[9px]">
                <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "var(--tile)" }}>{initialsOf(ticket.studentName)}</span>
                <div className="leading-[1.25]">
                  <div className="text-[11px] text-muted">Student</div>
                  <div className="text-[13.5px] font-semibold text-ink">{ticket.studentName}</div>
                </div>
              </div>
              <div className="leading-[1.25]">
                <div className="text-[11px] text-muted">Submitted</div>
                <div className="text-[13.5px] font-semibold text-ink tabular-nums">{ticket.createdAtMs ? longDateTime(ticket.createdAtMs) : "—"}</div>
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-pill-bg px-[15px] py-2 text-[13px] font-semibold text-pill-text">
            <StatusGlyph status={ticket.status} size={14} />
            {staffStatusLabel(ticket.status)}
          </span>
        </div>
      </div>

      <StaffTicketWorkspace ticket={ticket} events={events} meUid={meUid} roster={roster} />
    </div>
  );
}

function CenteredCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-8 pb-16 pt-5">
      <Link href="/staff/triage" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-muted-2 hover:text-ink">
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        Back to triage board
      </Link>
      <div className="rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
        <h1 className="mb-2 text-[20px] font-bold text-ink">{title}</h1>
        <p className="mx-auto max-w-[420px] text-[14px] leading-[1.6] text-body">{body}</p>
      </div>
    </div>
  );
}
