import type { Metadata } from "next";
import Link from "next/link";
import { CommentBox } from "@/components/requests/comment-box";
import { ReopenButton } from "@/components/requests/reopen-button";
import {
  getTicketDetail,
  type TicketEvent,
} from "@/lib/data/ticket-detail";
import { longDateTime, timelineStamp } from "@/lib/format";
import {
  categoryLabel,
  priorityStyle,
  STATUS_STEPS,
  stepStates,
  studentStatusStyle,
  type StatusGlyph,
} from "@/lib/labels";

export const metadata: Metadata = {
  title: "Track request · CampusConnect",
};

const BACK_ICON = (
  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

function BackLink() {
  return (
    <Link href="/requests" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-muted-2 hover:text-ink">
      {BACK_ICON}
      Back to requests
    </Link>
  );
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0]!)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function timeOrDash(ms: number | null): string {
  return ms == null ? "—" : timelineStamp(ms);
}

// ---- status pill ----------------------------------------------------------

function StatusGlyphIcon({ glyph }: { glyph: StatusGlyph }) {
  const c = {
    "aria-hidden": true,
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (glyph === "waiting")
    return (
      <svg {...c}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  if (glyph === "resolved")
    return (
      <svg {...c} strokeWidth={2.4}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  if (glyph === "assigned")
    return (
      <svg {...c}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  if (glyph === "closed")
    return (
      <svg {...c}>
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    );
  return <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-current" />;
}

function StatusPill({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const s = studentStatusStyle(status);
  const pad = size === "sm" ? "px-3 py-[5px] text-[12.5px]" : "px-[15px] py-2 text-[13px]";
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-pill-bg font-semibold text-pill-text ${pad}`}>
      <StatusGlyphIcon glyph={s.glyph} />
      {s.label}
    </span>
  );
}

// ---- stepper ---------------------------------------------------------------

function Stepper({ status }: { status: string }) {
  const steps = stepStates(status);
  const lvl = Math.max(0, STATUS_STEPS.findIndex((s) => s.status === status));

  return (
    <div className="my-[18px] rounded-2xl border border-line bg-card px-7 py-6 shadow-[0_1px_2px_var(--card-shadow)]">
      <ol className="flex items-start">
        {steps.map((s, i) => {
          const reached = i <= lvl;
          const leftColor = i === 0 ? "transparent" : lvl >= i ? "var(--teal)" : "var(--step-todo)";
          const rightColor = i === steps.length - 1 ? "transparent" : lvl > i ? "var(--teal)" : "var(--step-todo)";

          // Active step is gold in BOTH themes — the mockup's navy fill collapses into the navy
          // card in dark mode (indistinguishable from a todo step). Gold is the "you are here"
          // accent; done stays teal, todo stays outlined. (Deliberate deviation, recorded.)
          let dot = "flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold ";
          if (s.state === "done") dot += "bg-[color:var(--teal)] text-white";
          else if (s.state === "current") dot += "bg-gold text-navy";
          else dot += "bg-card text-muted border-2 border-[color:var(--step-todo)]";

          return (
            <li
              key={s.status}
              className="flex flex-1 flex-col items-center"
              aria-current={s.state === "current" ? "step" : undefined}
            >
              <div className="flex w-full items-center">
                <span className="h-0.5 flex-1" style={{ background: leftColor }} />
                <span className={dot}>
                  {s.state === "done" ? (
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="h-0.5 flex-1" style={{ background: rightColor }} />
              </div>
              <span className={`mt-[9px] text-center text-[12px] ${s.state === "current" ? "font-bold" : "font-medium"} ${reached ? "text-ink" : "text-muted"}`}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---- action / resolved banner ---------------------------------------------

function ActionBanner({ ticketId, status }: { ticketId: string; status: string }) {
  if (status === "waiting_for_student") {
    return (
      <div className="mb-6 flex items-center gap-[13px] rounded-[13px] border border-[color:var(--warn)] bg-[color:var(--warn-bg)] px-[18px] py-4">
        <span aria-hidden="true" className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] bg-gold">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d2c49" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </span>
        <div className="flex-1">
          <div className="text-[14.5px] font-bold text-ink">Action needed — your support team is waiting on you</div>
          <div className="mt-px text-[13px] text-body">Reply below to keep things moving.</div>
        </div>
      </div>
    );
  }

  if (status === "resolved" || status === "closed") {
    const closed = status === "closed";
    return (
      <div className="mb-6 flex items-center gap-[13px] rounded-[13px] border border-[color:var(--ok)] bg-[color:var(--ok-bg)] px-[18px] py-4">
        <span aria-hidden="true" className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--ok)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--card)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <div className="flex-1">
          <div className="text-[14.5px] font-bold text-ink">
            {closed ? "This request is resolved and closed" : "This request has been resolved"}
          </div>
          <div className="mt-px text-[13px] text-body">
            {closed
              ? "Reopen it if you still need help."
              : "If anything is still off, reopen the request."}
          </div>
        </div>
        <ReopenButton ticketId={ticketId} variant="ghost" />
      </div>
    );
  }

  return null;
}

// ---- activity timeline -----------------------------------------------------

function Avatar({ event }: { event: TicketEvent }) {
  const isSystem = event.actorRole === "system";
  const isStudent = event.actorRole === "student";
  if (isSystem) {
    return (
      <span aria-hidden="true" className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-pill-bg text-pill-text">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
      style={{ background: isStudent ? "#064948" : "var(--tile)" }}
    >
      {initialsOf(event.actorName)}
    </span>
  );
}

function RoleChip({ role }: { role: string }) {
  if (role === "student")
    return <span className="rounded-full bg-teal-tint px-2 py-0.5 text-[11px] font-semibold text-teal">You</span>;
  if (role === "system")
    return <span className="text-[11px] font-medium text-muted">System</span>;
  const label = role === "advisor" || role === "admin" || role === "staff" ? "Advisor" : role;
  return <span className="rounded-full bg-pill-bg px-2 py-0.5 text-[11px] font-semibold text-pill-text capitalize">{label}</span>;
}

function TimelineEntry({
  event,
  description,
  showLine,
}: {
  event: TicketEvent;
  description: string;
  showLine: boolean;
}) {
  const actorName = event.actorRole === "student" ? event.actorName : event.actorName || "CampusConnect";
  // The created marker carries the request's original description as its first comment.
  const bubble =
    event.type === "created"
      ? description || "Opened this request."
      : event.type === "student_reply"
        ? event.message
        : event.message;
  const hasBubble = Boolean(bubble);
  const hasChip =
    event.type !== "created" &&
    event.type !== "student_reply" &&
    event.toStatus != null &&
    event.toStatus !== event.fromStatus;

  return (
    <li className="flex gap-[14px]">
      <div className="flex flex-shrink-0 flex-col items-center">
        <Avatar event={event} />
        {showLine ? <span aria-hidden="true" className="my-1 min-h-[14px] w-0.5 flex-1 bg-divider" /> : null}
      </div>
      <div className="flex-1 pb-[22px]">
        <div className="mb-1.5 flex flex-wrap items-center gap-[9px]">
          <span className="text-[14px] font-semibold text-ink">{actorName}</span>
          <RoleChip role={event.actorRole} />
          <span className="text-[12px] tabular-nums text-muted">{timeOrDash(event.createdAtMs)}</span>
        </div>
        {hasChip ? (
          <div className="mb-1 inline-flex items-center gap-[7px] text-[12.5px] text-body">
            Status changed to{" "}
            <StatusPill status={event.toStatus as string} size="sm" />
          </div>
        ) : null}
        {hasBubble ? (
          <div className="rounded-xl border border-line bg-page px-[15px] py-[13px] text-[14px] leading-[1.55] text-body">
            {bubble}
          </div>
        ) : null}
      </div>
    </li>
  );
}

// ---- details sidebar -------------------------------------------------------

function SidebarRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-[3px] text-[12px] text-muted">{label}</div>
      {children}
    </div>
  );
}

// ---- states ----------------------------------------------------------------

function CenteredCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-8 pb-16 pt-7">
      <BackLink />
      <div className="rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
        <h1 className="mb-2 text-[18px] font-bold text-ink">{title}</h1>
        <p className="mx-auto max-w-[400px] text-[14px] leading-[1.6] text-body">{body}</p>
      </div>
    </div>
  );
}

// ---- page ------------------------------------------------------------------

export default async function TrackTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getTicketDetail(id);

  if (result.kind === "not_found") {
    return (
      <CenteredCard
        title="We couldn't find that request"
        body="It may have been removed, or the link is incorrect. Head back to your requests to find it."
      />
    );
  }
  if (result.kind === "error") {
    return (
      <CenteredCard
        title="We couldn't load this request"
        body="Something went wrong fetching it. Please refresh the page — if it keeps happening, try again in a few minutes."
      />
    );
  }

  const { ticket, events } = result;
  const priority = priorityStyle(ticket.priority);
  const inFlight =
    ticket.status === "new" ||
    ticket.status === "assigned" ||
    ticket.status === "waiting_for_student";
  const done = ticket.status === "resolved" || ticket.status === "closed";

  return (
    <div className="mx-auto w-full max-w-[1120px] px-8 pb-16 pt-7">
      <BackLink />

      {/* header */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-[18px]">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            <span className="rounded-md bg-teal-tint px-2.5 py-1 text-[12px] font-semibold text-teal">
              {categoryLabel(ticket.category)}
            </span>
            <span className="inline-flex items-center gap-[7px] text-[12px] font-bold uppercase tracking-[0.4px]" style={{ color: priority.colorVar }}>
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: priority.colorVar }} />
              {priority.label} priority
            </span>
            <span translate="no" className="font-mono text-[13px] text-muted">
              #{ticket.code || "—"}
            </span>
          </div>
          <h1 className="text-[26px] font-bold leading-[1.25] text-ink">
            {ticket.title || "Untitled request"}
          </h1>
        </div>
        <div className="mt-1">
          <StatusPill status={ticket.status} />
        </div>
      </div>

      <Stepper status={ticket.status} />

      <ActionBanner ticketId={ticket.id} status={ticket.status} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* activity + comment */}
        <section className="rounded-2xl border border-line bg-card px-7 py-6 shadow-[0_1px_2px_var(--card-shadow)]">
          <h2 className="mb-[22px] text-[16px] font-bold text-ink">Activity</h2>
          {events.length > 0 ? (
            <ol className="flex flex-col">
              {events.map((e, i) => (
                <TimelineEntry
                  key={e.id}
                  event={e}
                  description={ticket.description}
                  showLine={i < events.length - 1}
                />
              ))}
            </ol>
          ) : (
            <p className="pb-5 text-[14px] text-body">No activity yet.</p>
          )}

          {inFlight ? (
            <CommentBox ticketId={ticket.id} authorInitials={initialsOf(ticket.studentName)} />
          ) : null}

          {done ? (
            <div className="border-t border-divider pt-5">
              <div className="flex items-center gap-3 rounded-xl border border-line bg-page px-[17px] py-[15px]">
                <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <div className="flex-1 text-[13.5px] text-body">
                  {ticket.status === "closed"
                    ? "This request is closed. Reopen it if you still need help."
                    : "This request is resolved. Reopen it if you need more help."}
                </div>
                <ReopenButton ticketId={ticket.id} variant="solid" label="Reopen" />
              </div>
            </div>
          ) : null}
        </section>

        {/* details sidebar */}
        <aside className="rounded-2xl border border-line bg-card px-[26px] py-6 shadow-[0_1px_2px_var(--card-shadow)]">
          <div className="mb-4 text-[11px] font-bold uppercase tracking-[1.2px] text-gold-ink">
            Request details
          </div>
          <div className="flex flex-col gap-4">
            <SidebarRow label="Status">
              <StatusPill status={ticket.status} size="sm" />
            </SidebarRow>
            <SidebarRow label="Category">
              <div className="text-[14px] font-medium text-ink">{categoryLabel(ticket.category)}</div>
            </SidebarRow>
            <SidebarRow label="Priority">
              <span className="inline-flex items-center gap-[7px] text-[13px] font-bold" style={{ color: priority.colorVar }}>
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: priority.colorVar }} />
                {priority.label}
              </span>
            </SidebarRow>
            <div className="h-px bg-divider" />
            <SidebarRow label="Created">
              <div className="text-[14px] font-medium text-ink">{timeOrDash(ticket.createdAtMs) === "—" ? "—" : longDateTime(ticket.createdAtMs as number)}</div>
            </SidebarRow>
            <SidebarRow label="Created by">
              <div className="flex items-center gap-[9px]">
                <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#064948] text-[11px] font-bold text-white">
                  {initialsOf(ticket.studentName)}
                </span>
                <div className="text-[14px] font-medium text-ink">
                  {ticket.studentName} <span className="font-normal text-muted">(you)</span>
                </div>
              </div>
            </SidebarRow>
            <SidebarRow label="Assigned advisor">
              {ticket.assigneeName ? (
                <div className="flex items-center gap-[9px]">
                  <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--tile)] text-[11px] font-bold text-white">
                    {initialsOf(ticket.assigneeName)}
                  </span>
                  <div className="text-[14px] font-medium text-ink">{ticket.assigneeName}</div>
                </div>
              ) : (
                <div className="text-[14px] font-medium text-muted">Not yet assigned</div>
              )}
            </SidebarRow>
            <SidebarRow label="Last updated">
              <div className="text-[14px] font-medium text-ink">{timeOrDash(ticket.updatedAtMs)}</div>
            </SidebarRow>
          </div>
        </aside>
      </div>
    </div>
  );
}
