"use client";

// Kanban view with dnd-kit drag-and-drop. Drag is an ACCELERATOR, not a status bypass: a drop
// maps to a named staff action only for a permitted (from → to) pair. Input-free transitions
// commit on drop (new→assigned = claim-by-me; assigned→resolved = mark resolved); a transition
// that needs input (assigned→waiting_for_student = request info) opens a composer on drop and
// commits only on submit. Any other drop snaps back. Cards stay keyboard-openable (the body is
// a Link); dragging uses a dedicated grip handle. Every transition is also reachable from the
// ticket detail panel, so the board is fully operable without dragging.
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { BoardTicket } from "@/lib/data/staff-tickets";
import {
  claimTicket,
  markResolved,
  requestInfo,
  type StaffActionResult,
} from "@/lib/actions/staff-tickets";
import { KANBAN_COLUMNS, priorityStyle, staffCategoryLabel } from "@/lib/labels";
import { PriorityDot, initialsOf } from "@/components/staff/glyphs";

const IDLE: StaffActionResult = { status: "idle" };
const COLUMN_DOT: Record<string, string> = {
  new: "var(--gold)",
  assigned: "var(--teal)",
  waiting_for_student: "var(--pri-med)",
  resolved: "var(--pri-low)",
};

/** Permitted drops that commit directly (no extra input). */
function directAction(from: string, to: string) {
  if (from === "new" && to === "assigned") return claimTicket;
  if ((from === "assigned" || from === "waiting_for_student") && to === "resolved") return markResolved;
  return null;
}
/** Permitted drops that need a message first (open the composer). */
function needsComposer(from: string, to: string) {
  return from === "assigned" && to === "waiting_for_student";
}

export function TriageKanban({
  tickets,
  meUid,
  meName,
  onResult,
}: {
  tickets: BoardTicket[];
  meUid: string;
  meName: string;
  onResult: (res: StaffActionResult) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ ticketId: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStatus = (s: string) => tickets.filter((t) => t.status === s);
  const activeTicket = tickets.find((t) => t.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const to = e.over ? String(e.over.id) : null;
    const t = tickets.find((x) => x.id === id);
    if (!t || !to || to === t.status) return; // dropped nowhere / same column → snap back

    const action = directAction(t.status, to);
    if (action) {
      startTransition(async () => onResult(await action(IDLE, form({ ticketId: id }))));
      return;
    }
    if (needsComposer(t.status, to)) {
      setComposer({ ticketId: id });
      return;
    }
    // invalid transition → snap back (no write)
  }

  function submitComposer(message: string) {
    const c = composer;
    if (!c) return;
    setComposer(null);
    startTransition(async () => onResult(await requestInfo(IDLE, form({ ticketId: c.ticketId, message }))));
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-4 items-start gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn key={col.status} status={col.status} label={col.label} dot={COLUMN_DOT[col.status]!}
            cards={byStatus(col.status)} meUid={meUid} meName={meName} draggingId={activeId} pending={pending} />
        ))}
      </div>
      <DragOverlay>
        {activeTicket ? <CardBody t={activeTicket} meUid={meUid} overlay /> : null}
      </DragOverlay>
      {composer ? (
        <RequestInfoModal
          onCancel={() => setComposer(null)}
          onSubmit={submitComposer}
        />
      ) : null}
    </DndContext>
  );
}

function KanbanColumn({
  status,
  label,
  dot,
  cards,
  meUid,
  meName,
  draggingId,
  pending,
}: {
  status: string;
  label: string;
  dot: string;
  cards: BoardTicket[];
  meUid: string;
  meName: string;
  draggingId: string | null;
  pending: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className="min-h-[200px] rounded-[14px] border bg-[color:var(--kanban-col)] p-3.5"
      style={{ borderColor: isOver ? "var(--teal)" : "var(--border)", borderWidth: 1 }}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-[9px] w-[9px] rounded-full" style={{ background: dot }} />
          <span className="text-[13px] font-bold text-ink">{label}</span>
        </div>
        <span className="rounded-full border border-line bg-card px-2 py-px text-[11px] font-bold tabular-nums text-pill-text">{cards.length}</span>
      </div>
      <div className="flex flex-col gap-2.5" aria-busy={pending || undefined}>
        {cards.map((t) => (
          <DraggableCard key={t.id} t={t} meUid={meUid} meName={meName} hidden={draggingId === t.id} />
        ))}
        {cards.length === 0 ? (
          <div className="px-2 py-[22px] text-center text-[12.5px] text-muted">Nothing here</div>
        ) : null}
      </div>
    </div>
  );
}

function DraggableCard({ t, meUid, meName, hidden }: { t: BoardTicket; meUid: string; meName: string; hidden: boolean }) {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({ id: t.id });
  const style: React.CSSProperties = {
    opacity: hidden || isDragging ? 0.4 : 1,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <CardBody t={t} meUid={meUid} meName={meName} />
      {/* Drag handle — carries the dnd listeners so the card body Link stays clickable/keyboard-navigable. */}
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Drag ${t.code} to a different status`}
        className="absolute right-2 top-2 inline-flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-[color:var(--divider)]"
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" />
          <circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" />
        </svg>
      </button>
    </div>
  );
}

function CardBody({ t, meUid, meName, overlay }: { t: BoardTicket; meUid: string; meName?: string; overlay?: boolean }) {
  const pri = priorityStyle(t.priority);
  const mine = t.assigneeId === meUid;
  const leftBar = t.assigneeId ? (mine ? "var(--row-mine-bar)" : "transparent") : "var(--gold)";
  const inner = (
    <>
      <div className="mb-2 flex items-center justify-between gap-2 pr-6">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.3px]" style={{ color: pri.colorVar }}>
          <PriorityDot colorVar={pri.colorVar} size={7} />
          {pri.label}
        </span>
        <span className="text-[11px] text-muted" translate="no">{t.code}</span>
      </div>
      <div className="mb-[9px] text-[14px] font-semibold leading-[1.35] text-ink">{t.title}</div>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-[5px] bg-teal-tint px-2 py-0.5 text-[11px] font-semibold text-teal">{staffCategoryLabel(t.category)}</span>
        {t.assigneeId ? (
          <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: mine ? "var(--teal-solid)" : "var(--tile)" }}>
            {initialsOf(t.assigneeName ?? "")}
          </span>
        ) : (
          <span aria-hidden="true" className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-dashed border-field text-muted">—</span>
        )}
      </div>
    </>
  );
  const cls = "block rounded-[11px] border border-line bg-card p-[13px_14px] px-[14px] py-[13px] shadow-[0_1px_2px_var(--card-shadow)]";
  const styleBar = { borderLeft: `3px solid ${leftBar}` };
  void meName;
  if (overlay) {
    return <div className={`${cls} w-[240px] cursor-grabbing`} style={styleBar}>{inner}</div>;
  }
  return (
    <Link href={`/staff/requests/${t.id}`} className={`${cls} hover:shadow-[0_4px_14px_var(--card-shadow)]`} style={styleBar}>
      {inner}
    </Link>
  );
}

function RequestInfoModal({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (message: string) => void }) {
  const [message, setMessage] = useState("");
  return (
    <div role="dialog" aria-modal="true" aria-label="Request info from student" className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[440px] rounded-2xl border border-line bg-card p-6 shadow-xl">
        <h2 className="mb-1 text-[17px] font-bold text-ink">Request info from student</h2>
        <p className="mb-4 text-[13px] leading-[1.5] text-body">Moving this to <strong>Waiting for student</strong> — tell them what you need. This is visible to the student.</p>
        <label htmlFor="ki-msg" className="sr-only">Message to student</label>
        <textarea
          id="ki-msg"
          className="field"
          rows={4}
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Can you confirm your student ID and the course code?"
        />
        <div className="mt-4 flex justify-end gap-2.5">
          <button type="button" onClick={onCancel} className="rounded-[10px] border border-[color:var(--sbtn-border)] bg-[color:var(--sbtn-bg)] px-4 py-2.5 text-[13.5px] font-semibold text-[color:var(--sbtn-text)]">Cancel</button>
          <button
            type="button"
            disabled={!message.trim()}
            onClick={() => onSubmit(message.trim())}
            className="rounded-[10px] bg-gold px-4 py-2.5 text-[13.5px] font-bold text-navy hover:bg-gold-hover disabled:opacity-50"
          >
            Send &amp; move
          </button>
        </div>
      </div>
    </div>
  );
}

function form(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}
