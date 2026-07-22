"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  type ActionResult,
  cancelAppointment,
  rescheduleAppointment,
} from "@/lib/actions/appointments";
import {
  type DateChip,
  type ExistingSpan,
  generateSlots,
  type Slot,
} from "@/lib/advising";

const IDLE: ActionResult = { status: "idle" };

const gold = "inline-flex w-full items-center justify-center gap-2 rounded-[11px] bg-gold px-4 py-[13px] text-[14.5px] font-bold text-navy shadow-[0_4px_12px_rgba(215,165,36,0.28)] hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-70";
const outline = "inline-flex w-full items-center justify-center gap-2 rounded-[11px] border border-field bg-card px-4 py-3 text-[14px] font-semibold text-ink hover:border-[color:var(--card-hover-border)]";
const danger = "inline-flex w-full items-center justify-center gap-1.5 rounded-[11px] px-4 py-2.5 text-[13.5px] font-semibold text-[color:var(--cancel)] hover:opacity-80";

function ErrorNote({ state }: { state: ActionResult }) {
  if (state.status !== "error") return null;
  return <p role="alert" className="text-center text-[13px] font-medium text-err">{state.message}</p>;
}

function RSlot({ slot, selected, onSelect }: { slot: Slot; selected: boolean; onSelect: (ms: number) => void }) {
  const style = selected
    ? { background: "var(--sel-bg)", color: "var(--sel-text)", border: "1.5px solid var(--sel-bg)", fontWeight: 700 }
    : slot.available
      ? { background: "var(--card)", color: "var(--ink)", border: "1.5px solid var(--slot-border)", fontWeight: 600 }
      : { background: "var(--slot-un-bg)", color: "var(--slot-un-text)", border: "1.5px solid transparent", fontWeight: 500, textDecoration: "line-through" as const };
  return (
    <button type="button" disabled={!slot.available} aria-pressed={selected} onClick={() => onSelect(slot.startMs)}
      className="rounded-[10px] px-1 py-2.5 text-[13px] disabled:cursor-not-allowed" style={style}>
      {slot.label}
    </button>
  );
}

export function AppointmentActions({
  id,
  status,
  mode,
  service,
  dateChips,
  nowMs,
  existing,
}: {
  id: string;
  status: string;
  mode: string;
  service: string;
  dateChips: DateChip[];
  nowMs: number;
  existing: ExistingSpan[];
}) {
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelAppointment, IDLE);
  const [reschedState, reschedAction, reschedPending] = useActionState(rescheduleAppointment, IDLE);
  const [rescheduling, setRescheduling] = useState(false);
  const [rDate, setRDate] = useState(dateChips[0]?.ms ?? nowMs);
  const [rSlot, setRSlot] = useState<number | null>(null);

  const { morning, afternoon } = useMemo(
    () => generateSlots(service, rDate, existing, nowMs),
    [service, rDate, existing, nowMs],
  );
  const rSlotOk = [...morning, ...afternoon].some((s) => s.startMs === rSlot && s.available);

  if (status === "completed") return null;

  if (status === "cancelled") {
    return (
      <Link href="/appointments/new" className={gold}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6" /><path d="M3.51 15a9 9 0 1 0 .49-9L3 8" /></svg>
        Book again
      </Link>
    );
  }

  // status === "booked"
  return (
    <div className="flex flex-col gap-2.5">
      {mode === "video" ? (
        <button type="button" className={gold} title="A join link will be available closer to your appointment.">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
          Join video call
        </button>
      ) : null}

      {!rescheduling ? (
        <button type="button" onClick={() => setRescheduling(true)} className={outline}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          Reschedule
        </button>
      ) : (
        <div className="rounded-[14px] border border-line bg-page p-4 text-left">
          <div className="mb-3 text-[13px] font-semibold text-ink">Pick a new time</div>
          <div className="mb-3.5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="New date">
            {dateChips.map((d) => {
              const on = d.ms === rDate;
              return (
                <button key={d.ms} type="button" aria-pressed={on} onClick={() => { setRDate(d.ms); setRSlot(null); }}
                  className={`flex w-[54px] flex-shrink-0 flex-col items-center gap-0.5 rounded-[10px] border-[1.5px] py-2 ${on ? "border-[color:var(--sel-bg)] bg-[color:var(--sel-bg)] text-[color:var(--sel-text)]" : "border-line bg-card text-ink"}`}>
                  <span className="text-[10px] font-semibold uppercase opacity-75">{d.weekday}</span>
                  <span className="text-[16px] font-bold leading-none">{d.day}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
            {[...morning, ...afternoon].map((s) => (
              <RSlot key={s.startMs} slot={s} selected={rSlot === s.startMs} onSelect={setRSlot} />
            ))}
          </div>

          <form action={reschedAction} className="mt-4 flex flex-col gap-2">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="startMs" value={rSlot ?? ""} />
            <button type="submit" disabled={!rSlotOk || reschedPending} className={gold}>
              {reschedPending ? "Rescheduling…" : "Confirm new time"}
            </button>
            <button type="button" onClick={() => { setRescheduling(false); setRSlot(null); }} className={outline}>
              Keep current time
            </button>
            <ErrorNote state={reschedState} />
          </form>
        </div>
      )}

      {!rescheduling ? (
        <form action={cancelAction} className="flex flex-col gap-1.5">
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={cancelPending} className={danger}>
            {cancelPending ? "Cancelling…" : "Cancel appointment"}
          </button>
          <ErrorNote state={cancelState} />
        </form>
      ) : null}
    </div>
  );
}
