"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import type { BoardTicket } from "@/lib/data/staff-tickets";
import type { StaffMember } from "@/lib/data/staff";
import {
  claimTicket,
  assignTicket,
  unassignTicket,
  type StaffActionResult,
} from "@/lib/actions/staff-tickets";
import {
  PRIORITY_RANK,
  priorityStyle,
  staffCategoryLabel,
  staffStatusLabel,
} from "@/lib/labels";
import { StatusGlyph, PriorityDot, initialsOf } from "@/components/staff/glyphs";
import { TriageKanban } from "@/components/staff/triage-kanban";

type View = "table" | "kanban";
type SortKey = "priority" | "newest" | "oldest";

const IDLE: StaffActionResult = { status: "idle" };

/** Compact age like "2h" / "3d" (no "ago"), matching the mockup's row meta. */
function ageShort(ms: number | null, now: number): string {
  if (!ms) return "—";
  const diff = Math.max(0, now - ms);
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const OPEN_STATUSES = ["new", "assigned", "waiting_for_student"];

export function TriageBoard({
  tickets,
  roster,
  meUid,
  meName,
  nowMs,
}: {
  tickets: BoardTicket[];
  roster: StaffMember[];
  meUid: string;
  meName: string;
  nowMs: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<View>("table");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [owner, setOwner] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("priority");
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  /** Run a staff action from a client control; refresh the RSC on success. */
  const run = (action: (p: StaffActionResult, fd: FormData) => Promise<StaffActionResult>, fd: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await action(IDLE, fd);
      if (res.status === "error") setError(res.message);
      else router.refresh();
    });
  };

  // Closed tickets are terminal — the board is a work queue, so exclude them.
  const active = useMemo(() => tickets.filter((t) => t.status !== "closed"), [tickets]);

  const kpis = useMemo(() => {
    const open = active.filter((t) => OPEN_STATUSES.includes(t.status));
    return {
      unassigned: active.filter((t) => !t.assigneeId).length,
      mine: active.filter((t) => t.assigneeId === meUid).length,
      total: open.length,
    };
  }, [active, meUid]);

  const filtered = useMemo(() => {
    let rows = active;
    if (status !== "all") rows = rows.filter((t) => t.status === status);
    if (priority !== "all") rows = rows.filter((t) => t.priority === priority);
    if (category !== "all") rows = rows.filter((t) => staffCategoryLabel(t.category) === category);
    if (owner === "unassigned") rows = rows.filter((t) => !t.assigneeId);
    else if (owner === "me") rows = rows.filter((t) => t.assigneeId === meUid);
    else if (owner !== "all") rows = rows.filter((t) => t.assigneeId === owner);
    if (unassignedOnly) rows = rows.filter((t) => !t.assigneeId);

    const sorted = [...rows].sort((a, b) => {
      if (sort === "priority") {
        const r = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
        return r !== 0 ? r : (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
      }
      if (sort === "oldest") return (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0);
      return (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
    });
    return sorted;
  }, [active, status, priority, category, owner, unassignedOnly, sort, meUid]);

  const unassignedRows = filtered.filter((t) => !t.assigneeId);
  const assignedRows = filtered.filter((t) => t.assigneeId);
  const isCleared = active.length > 0 && filtered.length === 0;
  const emptyQueue = active.length === 0;

  const otherStaff = roster.filter((s) => s.uid !== meUid);

  return (
    <div>
      {/* KPI TILES */}
      <div className="mb-[22px] flex flex-wrap gap-3">
        <KpiTile label="Unassigned" value={kpis.unassigned} colorVar="var(--gold-ink)" />
        <KpiTile label="Assigned to me" value={kpis.mine} colorVar="var(--teal)" />
        <KpiTile label="Open total" value={kpis.total} colorVar="var(--ink)" />
      </div>

      {/* VIEW TOGGLE */}
      <div className="mb-[18px] flex items-center justify-end">
        <div className="inline-flex gap-0.5 rounded-[10px] border border-field bg-card p-1" role="group" aria-label="Board view">
          <ViewButton active={view === "table"} onClick={() => setView("table")} label="Queue" icon="rows" />
          <ViewButton active={view === "kanban"} onClick={() => setView("kanban")} label="Kanban" icon="cols" />
        </div>
      </div>

      {/* CONTROLS BAR */}
      <div className="mb-[18px] flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-card p-4 shadow-[0_1px_2px_var(--card-shadow)]">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Status" value={status} onChange={setStatus} options={[
            { v: "all", l: "Status: All" },
            { v: "new", l: "New" },
            { v: "assigned", l: "Assigned" },
            { v: "waiting_for_student", l: "Waiting for student" },
            { v: "resolved", l: "Resolved" },
          ]} />
          <FilterSelect label="Priority" value={priority} onChange={setPriority} options={[
            { v: "all", l: "Priority: All" },
            { v: "high", l: "High" },
            { v: "medium", l: "Medium" },
            { v: "low", l: "Low" },
          ]} />
          <FilterSelect label="Owner" value={owner} onChange={setOwner} options={[
            { v: "all", l: "Owner: All" },
            { v: "unassigned", l: "Unassigned" },
            { v: "me", l: `${meName} (me)` },
            ...otherStaff.map((s) => ({ v: s.uid, l: s.displayName })),
          ]} />
          <FilterSelect label="Category" value={category} onChange={setCategory} options={[
            { v: "all", l: "Category: All" },
            { v: "Academic", l: "Academic" },
            { v: "Advising", l: "Advising" },
            { v: "Records", l: "Records" },
            { v: "Finance", l: "Finance" },
            { v: "IT Support", l: "IT Support" },
            { v: "Career", l: "Career" },
          ]} />
        </div>
        <div className="hidden h-[26px] w-px bg-divider sm:block" />
        <FilterSelect label="Sort" value={sort} onChange={(v) => setSort(v as SortKey)} options={[
          { v: "priority", l: "Sort: Priority (high → low)" },
          { v: "newest", l: "Sort: Date submitted (newest)" },
          { v: "oldest", l: "Sort: Date submitted (oldest)" },
        ]} />
        <button
          type="button"
          onClick={() => setUnassignedOnly((v) => !v)}
          aria-pressed={unassignedOnly}
          className={`inline-flex items-center gap-[9px] rounded-[9px] px-2 py-[7px] text-[13px] font-semibold ${unassignedOnly ? "text-ink" : "text-muted-2"}`}
        >
          <span
            aria-hidden="true"
            className="relative h-[21px] w-[38px] rounded-full transition-colors"
            style={{ background: unassignedOnly ? "var(--teal)" : "var(--field)" }}
          >
            <span
              className="absolute top-0.5 h-[17px] w-[17px] rounded-full bg-white"
              style={unassignedOnly ? { right: 2 } : { left: 2 }}
            />
          </span>
          Unassigned only
        </button>
      </div>

      {error ? (
        <div role="alert" className="mb-4 rounded-xl border border-[color:var(--alert-border)] bg-[color:var(--alert-bg)] px-4 py-3 text-[13.5px] font-medium text-[color:var(--alert-ink)]">
          {error}
        </div>
      ) : null}

      {emptyQueue || (isCleared && !unassignedOnly && status === "all" && priority === "all" && owner === "all" && category === "all") ? (
        <ClearedState />
      ) : view === "table" ? (
        <QueueView
          unassignedRows={unassignedRows}
          assignedRows={assignedRows}
          meUid={meUid}
          meName={meName}
          nowMs={nowMs}
          otherStaff={otherStaff}
          roster={roster}
          pending={pending}
          onClaim={(id) => run(claimTicket, fd({ ticketId: id }))}
          onUnassign={(id) => run(unassignTicket, fd({ ticketId: id }))}
          onAssign={(id, m) => run(assignTicket, fd({ ticketId: id, assigneeId: m.uid, assigneeName: m.displayName }))}
          isCleared={isCleared}
        />
      ) : (
        <TriageKanban
          tickets={filtered}
          meUid={meUid}
          meName={meName}
          onResult={(res) => {
            if (res.status === "error") setError(res.message);
            else {
              setError(null);
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}

/** Build FormData from a plain object. */
function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

function KpiTile({ label, value, colorVar }: { label: string; value: number; colorVar: string }) {
  return (
    <div className="min-w-[104px] rounded-xl border border-line bg-card px-[18px] py-3">
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className="text-[24px] font-extrabold tabular-nums" style={{ color: colorVar }}>{value}</div>
    </div>
  );
}

function ViewButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: "rows" | "cols" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold ${active ? "text-white" : "bg-transparent text-muted-2"}`}
      style={active ? { background: "var(--tile)" } : undefined}
    >
      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {icon === "rows" ? (
          <>
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </>
        ) : (
          <>
            <rect x="3" y="3" width="7" height="18" />
            <rect x="14" y="3" width="7" height="11" />
          </>
        )}
      </svg>
      {label}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-[9px] border border-field bg-[color:var(--field-bg)] py-2 pl-3 pr-7 text-[13px] font-medium text-ink"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

function ClearedState() {
  return (
    <div className="rounded-2xl border border-line bg-card px-8 py-[60px] text-center shadow-[0_1px_2px_var(--card-shadow)]">
      <div className="mx-auto mb-5 flex h-[74px] w-[74px] items-center justify-center rounded-full bg-teal-tint">
        <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <h3 className="mb-[9px] text-[21px] font-bold text-ink">The queue is clear 🎉</h3>
      <p className="mx-auto mb-2 max-w-[420px] text-[14.5px] leading-[1.6] text-body">
        Every incoming request has an owner — nothing is waiting to be triaged right now. Nice work, team.
      </p>
      <p className="mx-auto max-w-[420px] text-[13px] leading-[1.6] text-muted">
        New requests will appear here the moment students submit them.
      </p>
    </div>
  );
}

// ---- Queue (grouped tables) ----

const GRID = "grid-cols-[96px_2.3fr_1.3fr_1.3fr_1.5fr_1.7fr]";

function QueueView({
  unassignedRows,
  assignedRows,
  meUid,
  meName,
  nowMs,
  otherStaff,
  roster,
  pending,
  onClaim,
  onUnassign,
  onAssign,
  isCleared,
}: {
  unassignedRows: BoardTicket[];
  assignedRows: BoardTicket[];
  meUid: string;
  meName: string;
  nowMs: number;
  otherStaff: StaffMember[];
  roster: StaffMember[];
  pending: boolean;
  onClaim: (id: string) => void;
  onUnassign: (id: string) => void;
  onAssign: (id: string, m: StaffMember) => void;
  isCleared: boolean;
}) {
  if (isCleared) {
    return (
      <div className="rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
        <h3 className="mb-2 text-[18px] font-bold text-ink">No requests match these filters</h3>
        <p className="mx-auto max-w-[400px] text-[14px] leading-[1.6] text-body">Try clearing a filter to see more of the queue.</p>
      </div>
    );
  }
  return (
    <div>
      {unassignedRows.length > 0 ? (
        <>
          <GroupHeader dotColor="var(--gold)" label="Needs triage · unassigned" count={unassignedRows.length} countGold />
          <div className="mb-6 overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_1px_2px_var(--card-shadow)]">
            <TableHead />
            {unassignedRows.map((t) => (
              <TicketRow key={t.id} t={t} nowMs={nowMs} meUid={meUid} meName={meName}
                rowBg="var(--row-unassigned)" leftBar="var(--unassigned-bar, var(--gold))">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onClaim(t.id)}
                    className="inline-flex items-center gap-[7px] rounded-[9px] bg-gold px-[15px] py-[9px] text-[13px] font-bold text-navy shadow-[0_3px_9px_rgba(215,165,36,0.28)] hover:bg-gold-hover disabled:opacity-60"
                  >
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    Claim
                  </button>
                  <AssignSelect placeholder="Assign to…" staff={roster} meUid={meUid}
                    onPick={(m) => onAssign(t.id, m)} disabled={pending} />
                </div>
              </TicketRow>
            ))}
          </div>
        </>
      ) : null}

      {assignedRows.length > 0 ? (
        <>
          <GroupHeader dotColor="var(--teal)" label="In progress · assigned" count={assignedRows.length} />
          <div className="overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_1px_2px_var(--card-shadow)]">
            <TableHead />
            {assignedRows.map((t) => {
              const mine = t.assigneeId === meUid;
              return (
                <TicketRow key={t.id} t={t} nowMs={nowMs} meUid={meUid} meName={meName}
                  rowBg={mine ? "var(--row-mine)" : "var(--card)"} leftBar={mine ? "var(--row-mine-bar)" : "transparent"}>
                  <div className="flex items-center justify-end gap-2">
                    <AssignSelect placeholder="Reassign…" staff={otherStaff} meUid={meUid}
                      onPick={(m) => onAssign(t.id, m)} disabled={pending} />
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onUnassign(t.id)}
                      className="rounded-[9px] border border-[color:var(--sbtn-border)] bg-[color:var(--sbtn-bg)] px-[13px] py-[9px] text-[13px] font-semibold text-[color:var(--sbtn-text)] hover:border-[color:var(--muted)] disabled:opacity-60"
                    >
                      Unassign
                    </button>
                  </div>
                </TicketRow>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function GroupHeader({ dotColor, label, count, countGold }: { dotColor: string; label: string; count: number; countGold?: boolean }) {
  return (
    <div className="mb-2.5 ml-0.5 mt-0.5 flex items-center gap-[9px]">
      <span aria-hidden="true" className="h-[9px] w-[9px] rounded-full" style={{ background: dotColor }} />
      <span className="text-[12px] font-bold uppercase tracking-[0.6px] text-ink">{label}</span>
      <span
        className="rounded-full px-2 py-px text-[11px] font-bold tabular-nums"
        style={countGold ? { background: "var(--gold)", color: "#0d2c49" } : { background: "var(--pill-bg)", color: "var(--pill-text)" }}
      >
        {count}
      </span>
    </div>
  );
}

function TableHead() {
  return (
    <div className={`grid ${GRID} gap-3.5 border-b border-line bg-[color:var(--head-bg)] px-5 py-[13px] text-[11px] font-bold uppercase tracking-[0.5px] text-muted max-[960px]:grid-cols-[70px_1.6fr_1fr]`}>
      <span>Priority</span>
      <span>Request</span>
      <span>Status</span>
      <span className="max-[960px]:hidden">Owner</span>
      <span className="max-[960px]:hidden">Next action</span>
      <span className="text-right">Actions</span>
    </div>
  );
}

function TicketRow({
  t,
  nowMs,
  meUid,
  meName,
  rowBg,
  leftBar,
  children,
}: {
  t: BoardTicket;
  nowMs: number;
  meUid: string;
  meName: string;
  rowBg: string;
  leftBar: string;
  children: React.ReactNode;
}) {
  const pri = priorityStyle(t.priority);
  const mine = t.assigneeId === meUid;
  return (
    <div
      className={`grid ${GRID} items-center gap-3.5 border-b border-divider px-5 py-4 max-[960px]:grid-cols-[70px_1.6fr_1fr]`}
      style={{ background: rowBg, borderLeft: `3px solid ${leftBar}` }}
    >
      <span className="inline-flex items-center gap-[7px] text-[12.5px] font-bold uppercase tracking-[0.3px]" style={{ color: pri.colorVar }}>
        <PriorityDot colorVar={pri.colorVar} />
        {pri.label}
      </span>
      <div className="min-w-0">
        <Link href={`/staff/requests/${t.id}`} className="line-clamp-1 text-[14.5px] font-semibold leading-[1.3] text-ink hover:text-teal">
          {t.title}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-[5px] bg-teal-tint px-2 py-0.5 text-[11px] font-semibold text-teal">{staffCategoryLabel(t.category)}</span>
          <span className="text-[12px] text-muted"><span translate="no">{t.code}</span> · {ageShort(t.createdAtMs, nowMs)}</span>
        </div>
      </div>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-pill-bg px-[11px] py-[5px] text-[12px] font-semibold text-pill-text">
        <StatusGlyph status={t.status} />
        {staffStatusLabel(t.status)}
      </span>
      <span className="inline-flex items-center gap-2 max-[960px]:hidden">
        {t.assigneeId ? (
          <>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: mine ? "var(--teal-solid)" : "var(--tile)" }}>
              {initialsOf(t.assigneeName ?? "")}
            </span>
            <span className={`text-[13px] text-ink ${mine ? "font-bold" : "font-medium"}`}>
              {mine ? `${meName} (you)` : t.assigneeName}
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-[7px] text-[13px] font-medium text-muted">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-dashed border-field">
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </span>
            Unassigned
          </span>
        )}
      </span>
      <span className="text-[13px] font-medium text-body max-[960px]:hidden">{t.nextAction ?? "—"}</span>
      <div className="max-[960px]:col-span-full max-[960px]:justify-start">{children}</div>
    </div>
  );
}

function AssignSelect({
  placeholder,
  staff,
  meUid,
  onPick,
  disabled,
}: {
  placeholder: string;
  staff: StaffMember[];
  meUid: string;
  onPick: (m: StaffMember) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLSelectElement>(null);
  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label={placeholder}
        ref={ref}
        disabled={disabled}
        defaultValue=""
        onChange={(e) => {
          const m = staff.find((s) => s.uid === e.target.value);
          if (m) onPick(m);
          if (ref.current) ref.current.value = "";
        }}
        className="appearance-none rounded-[9px] border border-[color:var(--sbtn-border)] bg-[color:var(--sbtn-bg)] py-[9px] pl-[13px] pr-[30px] text-[13px] font-semibold text-[color:var(--sbtn-text)] disabled:opacity-60"
      >
        <option value="" disabled>{placeholder}</option>
        {staff.map((s) => (
          <option key={s.uid} value={s.uid}>{s.uid === meUid ? `${s.displayName} (me)` : s.displayName}</option>
        ))}
      </select>
      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
