"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { bookAppointment, type BookState } from "@/lib/actions/appointments";
import {
  ADVISORS,
  advisorById,
  type DateChip,
  type ExistingSpan,
  generateSlots,
  serviceByValue,
  SERVICES,
  type Slot,
} from "@/lib/advising";
import { clockTime, dateTile } from "@/lib/format";

const INITIAL: BookState = { status: "idle" };

type StepState = "done" | "current" | "todo";

function StepDot({ n, state }: { n: number; state: StepState }) {
  const base =
    "flex h-[26px] w-[26px] items-center justify-center rounded-full text-[12px] font-bold";
  if (state === "done")
    return (
      <span className={`${base} bg-teal text-white`}>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      </span>
    );
  if (state === "current")
    return <span className={`${base} bg-[color:var(--tile)] text-white`}>{n}</span>;
  return <span className={`${base} border-2 border-line bg-card text-muted`}>{n}</span>;
}

function StepIndicator({ hasService, hasAdvisor, hasSlot }: { hasService: boolean; hasAdvisor: boolean; hasSlot: boolean }) {
  const steps: { name: string; state: StepState }[] = [
    { name: "Service", state: hasService ? "done" : "current" },
    { name: "Advisor", state: hasAdvisor ? "done" : hasService ? "current" : "todo" },
    { name: "Date & time", state: hasSlot ? "done" : hasAdvisor ? "current" : "todo" },
    { name: "Confirm", state: hasSlot ? "current" : "todo" },
  ];
  return (
    <ol className="mb-[26px] flex flex-wrap items-center gap-2">
      {steps.map((st, i) => (
        <li key={st.name} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <StepDot n={i + 1} state={st.state} />
            <span className={`text-[13px] ${st.state === "todo" ? "font-medium text-muted" : "font-semibold text-ink"}`}>
              {st.name}
            </span>
          </div>
          {i < steps.length - 1 ? <span className="h-0.5 w-[22px] bg-divider" aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  );
}

function SectionHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-[15px] flex items-center gap-[9px]">
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-teal-tint text-[11px] font-bold text-teal">{n}</span>
      <h2 className="text-[15px] font-bold text-ink">{title}</h2>
    </div>
  );
}

const cardCls = "rounded-2xl border border-line bg-card p-6 shadow-[0_1px_2px_var(--card-shadow)]";

function SlotButton({ slot, selected, onSelect }: { slot: Slot; selected: boolean; onSelect: (ms: number) => void }) {
  const style = selected
    ? { background: "var(--sel-bg)", color: "var(--sel-text)", border: "1.5px solid var(--sel-bg)", fontWeight: 700 }
    : slot.available
      ? { background: "var(--card)", color: "var(--ink)", border: "1.5px solid var(--slot-border)", fontWeight: 600 }
      : { background: "var(--slot-un-bg)", color: "var(--slot-un-text)", border: "1.5px solid transparent", fontWeight: 500, textDecoration: "line-through" as const };
  return (
    <button
      type="button"
      disabled={!slot.available}
      aria-pressed={selected}
      onClick={() => onSelect(slot.startMs)}
      className="rounded-[10px] px-1.5 py-[11px] text-[13.5px] disabled:cursor-not-allowed"
      style={style}
    >
      {slot.label}
    </button>
  );
}

export function BookingWizard({
  dateChips,
  nowMs,
  existing,
}: {
  dateChips: DateChip[];
  nowMs: number;
  existing: ExistingSpan[];
}) {
  const [state, formAction, isPending] = useActionState(bookAppointment, INITIAL);
  const [service, setService] = useState(SERVICES[0]!.value);
  const [advisorId, setAdvisorId] = useState(ADVISORS[0]!.id);
  const [dateMs, setDateMs] = useState(dateChips[0]?.ms ?? nowMs);
  const [slotMs, setSlotMs] = useState<number | null>(null);

  const { morning, afternoon } = useMemo(
    () => generateSlots(service, dateMs, existing, nowMs),
    [service, dateMs, existing, nowMs],
  );
  const selectedSlot = useMemo(
    () => [...morning, ...afternoon].find((s) => s.startMs === slotMs) ?? null,
    [morning, afternoon, slotMs],
  );

  if (state.status === "success") {
    return <BookedPanel id={state.id} service={service} advisorId={advisorId} slotMs={slotMs} selectedEnd={selectedSlot?.endMs ?? null} />;
  }

  const advisor = advisorById(advisorId)!;
  const svc = serviceByValue(service)!;
  const selectedChip = dateChips.find((d) => d.ms === dateMs);
  const canConfirm = Boolean(selectedSlot?.available) && slotMs != null;

  // Changing service/date can invalidate the chosen slot.
  const onService = (v: string) => { setService(v); setSlotMs(null); };
  const onDate = (ms: number) => { setDateMs(ms); setSlotMs(null); };

  return (
    <div>
      <h1 className="mb-1.5 text-[28px] font-bold text-ink">Book an advising appointment</h1>
      <p className="mb-5 max-w-[600px] text-[15px] leading-[1.6] text-body">
        Choose a service, pick your advisor, and grab a time that works — no back-and-forth email needed.
      </p>

      <StepIndicator hasService={!!service} hasAdvisor={!!advisorId} hasSlot={slotMs != null} />

      <form action={formAction} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <input type="hidden" name="service" value={service} />
        <input type="hidden" name="advisorId" value={advisorId} />
        <input type="hidden" name="startMs" value={slotMs ?? ""} />

        {/* LEFT: selections */}
        <div className="flex flex-col gap-5">
          {/* SERVICE */}
          <div className={cardCls}>
            <SectionHead n={1} title="Service" />
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Service">
              {SERVICES.map((s) => {
                const on = service === s.value;
                return (
                  <button key={s.value} type="button" role="radio" aria-checked={on} onClick={() => onService(s.value)}
                    className={`rounded-xl border-[1.5px] p-[14px] text-left ${on ? "border-teal bg-teal-tint" : "border-line bg-card"}`}>
                    <div className="text-[14px] font-semibold text-ink">{s.label}</div>
                    <div className="mt-0.5 text-[12px] text-muted">{s.durationMin} min</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ADVISOR */}
          <div className={cardCls}>
            <SectionHead n={2} title="Advisor" />
            <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Advisor">
              {ADVISORS.map((a) => {
                const on = advisorId === a.id;
                return (
                  <button key={a.id} type="button" role="radio" aria-checked={on} onClick={() => setAdvisorId(a.id)}
                    className={`flex items-center gap-[13px] rounded-xl border-[1.5px] p-[13px] ${on ? "border-teal bg-teal-tint" : "border-line bg-card"}`}>
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--tile)] text-[14px] font-bold text-white">{a.initials}</span>
                    <span className="flex-1 text-left">
                      <span className="block text-[14px] font-semibold text-ink">{a.name}</span>
                      <span className="block text-[12.5px] text-muted">{a.focus}</span>
                    </span>
                    <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${on ? "bg-teal text-white" : "border-[1.5px] border-field text-transparent"}`}>
                      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DATE + TIME */}
          <div className={cardCls}>
            <SectionHead n={3} title="Date & time" />
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1.5" role="group" aria-label="Date">
              {dateChips.map((d) => {
                const on = d.ms === dateMs;
                return (
                  <button key={d.ms} type="button" aria-pressed={on} onClick={() => onDate(d.ms)}
                    className={`flex w-16 flex-shrink-0 flex-col items-center gap-0.5 rounded-xl border-[1.5px] py-[11px] ${on ? "border-[color:var(--sel-bg)] bg-[color:var(--sel-bg)] text-[color:var(--sel-text)]" : "border-line bg-card text-ink"}`}>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.3px] opacity-75">{d.weekday}</span>
                    <span className="text-[19px] font-bold leading-none">{d.day}</span>
                    <span className="text-[11px] opacity-75">{d.month}</span>
                  </button>
                );
              })}
            </div>

            {state.status === "error" ? (
              <div role="alert" className="mb-[18px] flex items-start gap-[11px] rounded-[11px] border border-err bg-err-bg px-[15px] py-[13px]">
                <span className="mt-px flex-shrink-0 text-err">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                </span>
                <div>
                  <div className="text-[14px] font-semibold text-ink">That time didn&apos;t work</div>
                  <div className="mt-0.5 text-[13px] text-body">{state.message}</div>
                </div>
              </div>
            ) : null}

            <SlotGrid label="Morning" slots={morning} selected={slotMs} onSelect={setSlotMs} />
            <div className="h-[18px]" />
            <SlotGrid label="Afternoon" slots={afternoon} selected={slotMs} onSelect={setSlotMs} />

            <div className="mt-[18px] flex flex-wrap items-center gap-[18px] border-t border-divider pt-4">
              <Legend swatch={{ background: "var(--card)", border: "1px solid var(--slot-border)" }} text="Available" />
              <Legend swatch={{ background: "var(--sel-bg)" }} text="Selected" />
              <Legend swatch={{ background: "var(--slot-un-bg)" }} text="Unavailable" />
            </div>
          </div>
        </div>

        {/* RIGHT: summary */}
        <aside className={`sticky top-[92px] ${cardCls}`}>
          <div className="mb-4 text-[11px] font-bold uppercase tracking-[1.2px] text-gold-ink">Your appointment</div>
          <dl className="flex flex-col gap-[15px]">
            <SummaryRow label="Service" value={svc.label} />
            <SummaryRow label="Advisor" value={advisor.name} />
            <SummaryRow label="Date" value={selectedChip ? new Date(selectedChip.ms).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : "—"} />
            <SummaryRow label="Time" value={selectedSlot ? `${clockTime(selectedSlot.startMs)} – ${clockTime(selectedSlot.endMs)}` : "Pick a time"} />
          </dl>
          <div className="my-5 h-px bg-divider" />
          <button type="submit" disabled={!canConfirm || isPending}
            className="inline-flex w-full items-center justify-center gap-[9px] rounded-[11px] bg-gold px-4 py-3.5 text-[15px] font-bold text-navy shadow-[0_4px_12px_rgba(215,165,36,0.28)] hover:bg-gold-hover disabled:cursor-not-allowed disabled:bg-[color:var(--slot-un-bg)] disabled:text-muted disabled:shadow-none">
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            {isPending ? "Booking…" : "Confirm booking"}
          </button>
          <p className="mt-2.5 text-center text-[12px] text-muted">
            {canConfirm ? "Free to cancel or reschedule up to 24h before." : "Choose an available time to continue."}
          </p>
        </aside>
      </form>
    </div>
  );
}

function SlotGrid({ label, slots, selected, onSelect }: { label: string; slots: Slot[]; selected: number | null; onSelect: (ms: number) => void }) {
  return (
    <div>
      <div className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.6px] text-muted">{label}</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-[9px]">
        {slots.map((s) => (
          <SlotButton key={s.startMs} slot={s} selected={selected === s.startMs} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function Legend({ swatch, text }: { swatch: React.CSSProperties; text: string }) {
  return (
    <span className="inline-flex items-center gap-[7px] text-[12px] text-muted">
      <span className="h-3.5 w-3.5 rounded" style={{ ...swatch }} aria-hidden="true" />
      {text}
    </span>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="text-[14px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

function BookedPanel({ id, service, advisorId, slotMs, selectedEnd }: { id: string; service: string; advisorId: string; slotMs: number | null; selectedEnd: number | null }) {
  const advisor = advisorById(advisorId)!;
  const svc = serviceByValue(service)!;
  const tile = slotMs != null ? dateTile(slotMs) : null;
  const time = slotMs != null && selectedEnd != null ? `${clockTime(slotMs)} – ${clockTime(selectedEnd)}` : "";
  return (
    <div className="mx-auto mt-2 max-w-[600px]">
      <div className="rounded-[18px] border border-line bg-card px-10 py-11 text-center shadow-[0_1px_2px_var(--card-shadow)]">
        <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-teal-tint">
          <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 className="mb-[9px] text-[25px] font-bold text-ink">You&apos;re booked in</h1>
        <p className="mx-auto mb-6 max-w-[400px] text-[15px] leading-[1.6] text-body">
          A calendar invite and confirmation are on their way to your student email.
        </p>

        <div className="mb-6 flex items-center gap-4 rounded-[14px] border border-line bg-page p-[22px] text-left">
          {tile ? (
            <div className="w-16 flex-shrink-0 rounded-xl bg-[color:var(--tile)] py-[11px] text-center text-white">
              <div className="text-[11px] font-semibold uppercase tracking-[0.5px] text-gold">{tile.month}</div>
              <div className="text-[26px] font-bold leading-none">{tile.day}</div>
              <div className="text-[11px] text-nav-muted">{tile.weekday}</div>
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <span className="mb-2 inline-block rounded-md bg-teal-tint px-[9px] py-[3px] text-[12px] font-semibold text-teal">{svc.label}</span>
            <div className="mb-2 text-[16px] font-bold text-ink">{time}</div>
            <div className="mb-1 flex items-center gap-2 text-[13px] text-body">
              <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[color:var(--tile)] text-[9px] font-bold text-white">{advisor.initials}</span>
              {advisor.name}
            </div>
            <div className="text-[13px] text-body">{advisor.location}</div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Link href={`/appointments/${id}`} className="rounded-[11px] bg-gold px-[22px] py-[13px] text-[15px] font-semibold text-navy hover:bg-gold-hover">View appointment</Link>
          <Link href="/appointments/new" className="rounded-[11px] px-5 py-[13px] text-[15px] font-semibold text-body hover:text-ink">Book another</Link>
        </div>
      </div>
    </div>
  );
}
