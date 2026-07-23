"use client";

// The interactive half of the staff ticket detail: activity timeline (incl. internal notes),
// the two-mode composer (Reply to student / Internal note), and the status-actions + properties
// panel. Every mutation runs a named server action under the signed-in staff member; on success
// we refresh the RSC. Matches the Staff Ticket Detail mockup.
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { StaffTicket, StaffTicketEvent } from "@/lib/data/staff-tickets";
import type { StaffMember } from "@/lib/data/staff";
import {
  addInternalNote,
  assignTicket,
  claimTicket,
  closeTicket,
  markResolved,
  replyToStudentAsStaff,
  requestInfo,
  unassignTicket,
  updateTriageFields,
  type StaffActionResult,
} from "@/lib/actions/staff-tickets";
import { longDateTime } from "@/lib/format";
import { CATEGORY_OPTIONS, priorityStyle, staffCategoryLabel } from "@/lib/labels";
import { initialsOf } from "@/components/staff/glyphs";

const IDLE: StaffActionResult = { status: "idle" };
type ComposerMode = "reply" | "internal";

/** A staff-facing category select list (canonical value → staff label), deduped. */
const STAFF_CATEGORY_OPTIONS = CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: staffCategoryLabel(o.value) }));

function form(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

export function StaffTicketWorkspace({
  ticket,
  events,
  meUid,
  roster,
}: {
  ticket: StaffTicket;
  events: StaffTicketEvent[];
  meUid: string;
  roster: StaffMember[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<ComposerMode>(ticket.status === "new" ? "internal" : "reply");
  const [message, setMessage] = useState("");
  const [reminder, setReminder] = useState(false); // request-info / reminder modal open

  // Local triage-field state (priority/category/nextAction) — saved together (schema needs all).
  const [priority, setPriority] = useState(ticket.priority || "medium");
  const [category, setCategory] = useState(ticket.category || "other");
  const [nextAction, setNextAction] = useState(ticket.nextAction ?? "");

  const run = (action: (p: StaffActionResult, fd: FormData) => Promise<StaffActionResult>, fd: FormData, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await action(IDLE, fd);
      if (res.status === "error") setError(res.message);
      else {
        after?.();
        router.refresh();
      }
    });
  };

  const otherStaff = roster.filter((s) => s.uid !== meUid);

  function submitComposer() {
    const msg = message.trim();
    if (!msg) return;
    const action = mode === "reply" ? replyToStudentAsStaff : addInternalNote;
    run(action, form({ ticketId: ticket.id, message: msg }), () => setMessage(""));
  }

  function saveTriage(next: { priority?: string; category?: string; nextAction?: string }) {
    const p = next.priority ?? priority;
    const c = next.category ?? category;
    const n = next.nextAction ?? nextAction;
    run(updateTriageFields, form({ ticketId: ticket.id, priority: p, category: c, nextAction: n }));
  }

  const timeline = useMemo(() => buildTimeline(ticket, events), [ticket, events]);

  return (
    <div className="st-grid grid grid-cols-[1.6fr_1fr] items-start gap-6 max-[940px]:grid-cols-1">
      {/* LEFT: TIMELINE + COMPOSER */}
      <div className="rounded-2xl border border-line bg-card px-7 py-[26px] shadow-[0_1px_2px_var(--card-shadow)] max-[940px]:order-1">
        <h2 className="mb-[22px] text-[16px] font-bold text-ink">Activity</h2>
        <div className="flex flex-col">
          {timeline.map((e, i) => (
            <TimelineRow key={e.key} e={e} last={i === timeline.length - 1} />
          ))}
        </div>

        {/* COMPOSER */}
        <div className="border-t border-divider pt-5">
          <div className="mb-3.5 inline-flex gap-[3px] rounded-[10px] border border-line bg-page p-1">
            <ComposerTab active={mode === "reply"} onClick={() => setMode("reply")} accent="var(--teal)" label="Reply to student" icon="reply" />
            <ComposerTab active={mode === "internal"} onClick={() => setMode("internal")} accent="var(--internal-ink)" label="Internal note" icon="lock" />
          </div>

          <div
            className="overflow-hidden rounded-[13px] bg-[color:var(--composer-bg)]"
            style={{ border: `1.5px solid ${mode === "reply" ? "var(--teal)" : "var(--internal-ink)"}` }}
          >
            <div
              className="flex items-center gap-2 border-b px-[15px] py-2.5"
              style={{ background: mode === "reply" ? "var(--teal-tint)" : "var(--internal-bg)", borderColor: mode === "reply" ? "var(--teal)" : "var(--internal-ink)" }}
            >
              <ComposerBannerIcon mode={mode} />
              <span className="text-[12.5px] font-semibold" style={{ color: mode === "reply" ? "var(--teal)" : "var(--internal-ink)" }}>
                {mode === "reply"
                  ? `Visible to ${ticket.studentName} — sending sets status to “Waiting for student”`
                  : "Internal note — only staff can see this"}
              </span>
            </div>
            <label htmlFor="composer" className="sr-only">{mode === "reply" ? "Reply to student" : "Internal note"}</label>
            <textarea
              id="composer"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={mode === "reply" ? "Write a reply to the student…" : "Add a private note for the support team…"}
              className="field w-full resize-y border-none bg-transparent px-[15px] py-3.5 text-[14px]"
              style={{ borderRadius: 0 }}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-[15px] py-[11px]">
              <span className="text-[12px] text-muted">{message.trim().length}/2000</span>
              <button
                type="button"
                disabled={pending || !message.trim()}
                onClick={submitComposer}
                className="rounded-[10px] px-5 py-[11px] text-[14px] font-bold disabled:opacity-50"
                style={mode === "reply" ? { background: "var(--gold)", color: "#0d2c49" } : { background: "var(--tile)", color: "#fff" }}
              >
                {mode === "reply" ? "Send reply" : "Save note"}
              </button>
            </div>
          </div>
          <p className="mt-[9px] text-[12.5px] leading-[1.5] text-muted">
            {mode === "reply"
              ? "Replies move the ticket to “Waiting for student” and notify them in-app."
              : "Internal notes stay on the ticket for staff and never reach the student."}
          </p>
        </div>
      </div>

      {/* RIGHT: STATUS ACTIONS + PROPERTIES */}
      <aside className="st-side flex flex-col gap-4 max-[940px]:order-0">
        {error ? (
          <div role="alert" className="rounded-xl border border-[color:var(--alert-border)] bg-[color:var(--alert-bg)] px-4 py-3 text-[13px] font-medium text-[color:var(--alert-ink)]">
            {error}
          </div>
        ) : null}

        {/* STATUS ACTIONS */}
        <div className="rounded-2xl border border-line bg-card px-6 py-[22px] shadow-[0_1px_2px_var(--card-shadow)]">
          {ticket.status === "new" ? (
            <PanelBanner>
              This request just landed. Set its <strong>priority</strong> and <strong>category</strong>, then claim it to start working.
            </PanelBanner>
          ) : null}
          {ticket.status === "waiting_for_student" ? (
            <PanelBanner clock>
              <strong>Waiting on student</strong>
              <div className="mt-px text-[12px] font-normal text-body">Reply sent · awaiting their response</div>
            </PanelBanner>
          ) : null}
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[1px] text-[color:var(--gold-ink)]">Status actions</div>
          <StatusActions
            status={ticket.status}
            pending={pending}
            onClaim={() => run(claimTicket, form({ ticketId: ticket.id }))}
            onResolve={() => run(markResolved, form({ ticketId: ticket.id }))}
            onClose={() => run(closeTicket, form({ ticketId: ticket.id }))}
            onRequestInfo={() => setReminder(true)}
            onAssignFocus={() => document.getElementById("assignee-select")?.focus()}
          />
        </div>

        {/* PROPERTIES */}
        <div className="rounded-2xl border border-line bg-card px-6 py-[22px] shadow-[0_1px_2px_var(--card-shadow)]">
          <div className="mb-4 text-[11px] font-bold uppercase tracking-[1px] text-[color:var(--gold-ink)]">Properties</div>
          <div className="flex flex-col gap-4">
            {/* Assignee */}
            <div>
              <div className="mb-[7px] text-[12px] text-muted">Assignee</div>
              {ticket.assigneeId ? (
                <>
                  <div className="mb-[9px] flex items-center gap-2.5">
                    <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: ticket.assigneeId === meUid ? "var(--teal-solid)" : "var(--tile)" }}>
                      {initialsOf(ticket.assigneeName ?? "")}
                    </span>
                    <div className="text-[14px] font-semibold text-ink">
                      {ticket.assigneeName}{ticket.assigneeId === meUid ? <span className="font-normal text-muted"> (you)</span> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <ReassignSelect id="assignee-select" staff={otherStaff} disabled={pending}
                      onPick={(m) => run(assignTicket, form({ ticketId: ticket.id, assigneeId: m.uid, assigneeName: m.displayName }))} />
                    <button type="button" disabled={pending} onClick={() => run(unassignTicket, form({ ticketId: ticket.id }))}
                      className="whitespace-nowrap rounded-[9px] border border-[color:var(--sbtn-border)] bg-[color:var(--sbtn-bg)] px-[13px] py-[9px] text-[13px] font-semibold text-[color:var(--sbtn-text)] hover:border-[color:var(--muted)] disabled:opacity-60">
                      Unassign
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-[9px] text-[13.5px] font-medium text-muted">
                    <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full border-[1.5px] border-dashed border-field">
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    </span>
                    Unassigned — not yet claimed
                  </div>
                  <ReassignSelect id="assignee-select" placeholder="Assign to…" staff={roster} meUid={meUid} disabled={pending}
                    onPick={(m) => run(assignTicket, form({ ticketId: ticket.id, assigneeId: m.uid, assigneeName: m.displayName }))} />
                </div>
              )}
            </div>

            <div className="h-px bg-divider" />

            {/* Priority */}
            <div>
              <div className="mb-[7px] text-[12px] text-muted">Priority</div>
              <div className="flex gap-[7px]">
                {["low", "medium", "high"].map((p) => {
                  const on = priority === p;
                  const st = priorityStyle(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={pending}
                      aria-pressed={on}
                      onClick={() => { setPriority(p); saveTriage({ priority: p }); }}
                      className="flex-1 rounded-[9px] border-[1.5px] py-[9px] text-[13px] font-bold capitalize disabled:opacity-60"
                      style={on
                        ? { background: st.colorVar, color: "#fff", borderColor: st.colorVar }
                        : { background: "var(--field-bg)", color: "var(--body)", borderColor: "var(--field)" }}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category */}
            <div>
              <div className="mb-[7px] text-[12px] text-muted">Category</div>
              <div className="relative flex items-center">
                <label htmlFor="cat" className="sr-only">Category</label>
                <select
                  id="cat"
                  value={category}
                  disabled={pending}
                  onChange={(e) => { setCategory(e.target.value); saveTriage({ category: e.target.value }); }}
                  className="w-full appearance-none rounded-[10px] border border-field bg-[color:var(--field-bg)] py-[11px] pl-[13px] pr-[30px] text-[14px] font-medium text-ink"
                >
                  {STAFF_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </div>

            {/* Next action */}
            <div>
              <div className="mb-[7px] flex items-center gap-1.5">
                <span className="text-[12px] text-muted">Next action</span>
                <span className="rounded-full bg-pill-bg px-[7px] py-px text-[10.5px] text-muted">shown on board</span>
              </div>
              <input
                className="field"
                value={nextAction}
                disabled={pending}
                onChange={(e) => setNextAction(e.target.value)}
                onBlur={() => { if ((ticket.nextAction ?? "") !== nextAction) saveTriage({ nextAction }); }}
                placeholder="e.g. Confirm hold with Records"
              />
            </div>
          </div>
        </div>
      </aside>

      {reminder ? (
        <RequestInfoModal
          waiting={ticket.status === "waiting_for_student"}
          studentName={ticket.studentName}
          onCancel={() => setReminder(false)}
          onSubmit={(msg) => { setReminder(false); run(requestInfo, form({ ticketId: ticket.id, message: msg })); }}
        />
      ) : null}
    </div>
  );
}

// ---- timeline ----

interface TimelineItem {
  key: string;
  actor: string;
  tag: "Student" | "You" | "Advisor" | "System";
  initials: string;
  time: string;
  kind: "message" | "internal" | "event" | "system";
  body: string;
}

function buildTimeline(ticket: StaffTicket, events: StaffTicketEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  // The student's original request (the ticket body) opens the timeline.
  items.push({
    key: "req",
    actor: ticket.studentName,
    tag: "Student",
    initials: initialsOf(ticket.studentName),
    time: ticket.createdAtMs ? longDateTime(ticket.createdAtMs) : "",
    kind: "message",
    body: ticket.description,
  });
  for (const e of events) {
    if (e.type === "created") continue; // the request bubble above already represents this
    const isStaff = e.actorRole === "advisor" || e.actorRole === "admin";
    const tag: TimelineItem["tag"] = e.actorRole === "student" ? "Student" : isStaff ? "Advisor" : "System";
    if (e.type === "internal_note") {
      items.push({ key: e.id, actor: e.actorName, tag: "Advisor", initials: initialsOf(e.actorName), time: e.createdAtMs ? longDateTime(e.createdAtMs) : "", kind: "internal", body: e.message });
    } else if (e.type === "message" || e.type === "student_reply" || e.type === "info_requested") {
      items.push({ key: e.id, actor: e.actorName, tag, initials: initialsOf(e.actorName), time: e.createdAtMs ? longDateTime(e.createdAtMs) : "", kind: "message", body: e.message });
    } else {
      // status transition (claimed / resolved / closed / reassigned)
      const label = systemLine(e);
      items.push({ key: e.id, actor: e.actorName, tag: "System", initials: "", time: e.createdAtMs ? longDateTime(e.createdAtMs) : "", kind: "system", body: label });
    }
  }
  return items;
}

function systemLine(e: StaffTicketEvent): string {
  const verb: Record<string, string> = {
    claimed: "claimed this ticket",
    resolved: "marked this resolved",
    closed: "closed this ticket",
    reassigned: e.message || "updated the assignee",
  };
  const base = `${e.actorName} ${verb[e.type] ?? e.type}`;
  if (e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus) {
    return `${base} · ${statusWord(e.fromStatus)} → ${statusWord(e.toStatus)}`;
  }
  return base;
}
function statusWord(s: string): string {
  return ({ new: "New", assigned: "Assigned", waiting_for_student: "Waiting", resolved: "Resolved", closed: "Closed" } as Record<string, string>)[s] ?? s;
}

function TimelineRow({ e, last }: { e: TimelineItem; last: boolean }) {
  const isSystem = e.kind === "system";
  return (
    <div className="flex gap-3.5">
      <div className="flex flex-shrink-0 flex-col items-center">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold text-white"
          style={isSystem ? { background: "var(--teal-tint)", color: "var(--teal)" } : { background: e.tag === "Student" ? "var(--tile)" : "var(--teal-solid)" }}
        >
          {isSystem ? (
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : e.initials}
        </div>
        {!last ? <div className="my-1 min-h-[16px] w-0.5 flex-1 bg-divider" /> : null}
      </div>
      <div className="min-w-0 flex-1 pb-[22px]">
        <div className="mb-1.5 flex flex-wrap items-center gap-[9px]">
          <span className="text-[14px] font-semibold text-ink">{e.actor}</span>
          <TagChip tag={e.tag} />
          <span className="text-[12px] text-muted tabular-nums">{e.time}</span>
        </div>
        {e.kind === "internal" ? (
          <div className="rounded-xl border px-[15px] py-[13px]" style={{ background: "var(--internal-bg)", borderColor: "var(--internal-border)" }}>
            <div className="mb-[7px] flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.4px]" style={{ color: "var(--internal-ink)" }}>
              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Internal note · staff only
            </div>
            <div className="whitespace-pre-wrap text-[14px] leading-[1.55] text-body">{e.body}</div>
          </div>
        ) : e.kind === "message" ? (
          <div className="whitespace-pre-wrap rounded-xl border border-line bg-page px-[15px] py-[13px] text-[14px] leading-[1.55] text-body">{e.body}</div>
        ) : (
          <div className="text-[13.5px] leading-[1.5] text-body">{e.body}</div>
        )}
      </div>
    </div>
  );
}

function TagChip({ tag }: { tag: TimelineItem["tag"] }) {
  if (tag === "Student")
    return <span className="rounded-full bg-pill-bg px-2 py-0.5 text-[11px] font-semibold text-pill-text">Student</span>;
  if (tag === "You" || tag === "Advisor")
    return <span className="rounded-full bg-teal-tint px-2 py-0.5 text-[11px] font-semibold text-teal">{tag}</span>;
  return <span className="text-[11px] font-medium text-muted">System</span>;
}

// ---- composer bits ----

function ComposerTab({ active, onClick, accent, label, icon }: { active: boolean; onClick: () => void; accent: string; label: string; icon: "reply" | "lock" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-lg px-3.5 py-2 text-[13px] font-semibold"
      style={active ? { background: "var(--card)", color: accent, boxShadow: "0 1px 2px var(--card-shadow)" } : { background: "transparent", color: "var(--muted)" }}
    >
      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 inline align-[-2px]">
        {icon === "reply" ? (<><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></>) : (<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>)}
      </svg>
      {label}
    </button>
  );
}

function ComposerBannerIcon({ mode }: { mode: ComposerMode }) {
  const color = mode === "reply" ? "var(--teal)" : "var(--internal-ink)";
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {mode === "reply" ? (<><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></>) : (<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>)}
    </svg>
  );
}

function PanelBanner({ clock, children }: { clock?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-[10px] px-3.5 py-3" style={{ background: "var(--warn-bg)" }}>
      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-px flex-shrink-0">
        {clock ? (<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>) : (<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>)}
      </svg>
      <div className="text-[13px] leading-[1.5] text-ink">{children}</div>
    </div>
  );
}

function StatusActions({
  status,
  pending,
  onClaim,
  onResolve,
  onClose,
  onRequestInfo,
  onAssignFocus,
}: {
  status: string;
  pending: boolean;
  onClaim: () => void;
  onResolve: () => void;
  onClose: () => void;
  onRequestInfo: () => void;
  onAssignFocus: () => void;
}) {
  const primaryCls = "flex w-full items-center justify-center gap-2 rounded-[11px] bg-gold px-3 py-[13px] text-[14.5px] font-bold text-navy shadow-[0_4px_12px_rgba(215,165,36,0.28)] hover:bg-gold-hover disabled:opacity-60";
  const secondaryCls = "flex w-full items-center justify-center gap-2 rounded-[11px] border border-[color:var(--sbtn-border)] bg-[color:var(--sbtn-bg)] px-3 py-3 text-[14px] font-semibold text-[color:var(--sbtn-text)] hover:border-[color:var(--muted)] disabled:opacity-60";
  const check = <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;

  if (status === "closed") {
    return <p className="text-[13.5px] leading-[1.5] text-body">This request is closed. Reopen happens from the student side.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {status === "new" ? (
        <>
          <button type="button" disabled={pending} onClick={onClaim} className={primaryCls}>{check}Claim &amp; start working</button>
          <button type="button" disabled={pending} onClick={onAssignFocus} className={secondaryCls}>Assign to someone else</button>
        </>
      ) : status === "resolved" ? (
        <button type="button" disabled={pending} onClick={onClose} className={primaryCls}>{check}Close request</button>
      ) : (
        <>
          <button type="button" disabled={pending} onClick={onResolve} className={primaryCls}>{check}Mark resolved</button>
          <button type="button" disabled={pending} onClick={onRequestInfo} className={secondaryCls}>
            {status === "waiting_for_student" ? "Send a reminder" : "Request info from student"}
          </button>
        </>
      )}
    </div>
  );
}

function ReassignSelect({
  id,
  placeholder = "Reassign…",
  staff,
  meUid,
  disabled,
  onPick,
}: {
  id?: string;
  placeholder?: string;
  staff: StaffMember[];
  meUid?: string;
  disabled?: boolean;
  onPick: (m: StaffMember) => void;
}) {
  return (
    <div className="relative inline-flex flex-1 items-center">
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <select
        id={id}
        defaultValue=""
        disabled={disabled}
        onChange={(e) => {
          const m = staff.find((s) => s.uid === e.target.value);
          if (m) onPick(m);
          e.target.value = "";
        }}
        className="w-full appearance-none rounded-[9px] border border-field bg-[color:var(--field-bg)] py-[9px] pl-3 pr-7 text-[13px] font-semibold text-ink disabled:opacity-60"
      >
        <option value="" disabled>{placeholder}</option>
        {staff.map((s) => (
          <option key={s.uid} value={s.uid}>{meUid && s.uid === meUid ? `${s.displayName} (me)` : s.displayName}</option>
        ))}
      </select>
      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-2.5"><polyline points="6 9 12 15 18 9" /></svg>
    </div>
  );
}

function RequestInfoModal({ waiting, studentName, onCancel, onSubmit }: { waiting: boolean; studentName: string; onCancel: () => void; onSubmit: (msg: string) => void }) {
  const [msg, setMsg] = useState("");
  return (
    <div role="dialog" aria-modal="true" aria-label={waiting ? "Send a reminder" : "Request info from student"} className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[440px] rounded-2xl border border-line bg-card p-6 shadow-xl">
        <h2 className="mb-1 text-[17px] font-bold text-ink">{waiting ? "Send a reminder" : "Request info from student"}</h2>
        <p className="mb-4 text-[13px] leading-[1.5] text-body">Visible to {studentName}. Keeps the ticket in <strong>Waiting for student</strong>.</p>
        <label htmlFor="ri-msg" className="sr-only">Message to student</label>
        <textarea id="ri-msg" className="field" rows={4} autoFocus value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="What do you need from the student?" />
        <div className="mt-4 flex justify-end gap-2.5">
          <button type="button" onClick={onCancel} className="rounded-[10px] border border-[color:var(--sbtn-border)] bg-[color:var(--sbtn-bg)] px-4 py-2.5 text-[13.5px] font-semibold text-[color:var(--sbtn-text)]">Cancel</button>
          <button type="button" disabled={!msg.trim()} onClick={() => onSubmit(msg.trim())} className="rounded-[10px] bg-gold px-4 py-2.5 text-[13.5px] font-bold text-navy hover:bg-gold-hover disabled:opacity-50">Send</button>
        </div>
      </div>
    </div>
  );
}
