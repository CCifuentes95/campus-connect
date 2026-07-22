"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ListAppointment } from "@/lib/data/appointments";
import { modeShort } from "@/lib/advising";
import { clockTime, dateTile } from "@/lib/format";
import { appointmentStatusStyle, serviceLabel } from "@/lib/labels";

type Filter = "upcoming" | "past" | "all";
const TABS: { id: Filter; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
];

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function FormatIcon({ mode }: { mode: string }) {
  const p = { "aria-hidden": true, width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "var(--muted)", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (mode === "video")
    return <svg {...p}><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>;
  return <svg {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
}

function AppointmentListCard({ a, past }: { a: ListAppointment; past: boolean }) {
  const tile = dateTile(a.startMs);
  const badge = appointmentStatusStyle(a.status);
  const time = a.endMs ? `${clockTime(a.startMs)} – ${clockTime(a.endMs)}` : clockTime(a.startMs);
  const dimmed = a.status === "cancelled";
  return (
    <Link
      href={`/appointments/${a.id}`}
      className={`flex items-center gap-[18px] rounded-[14px] border border-line bg-card p-5 shadow-[0_1px_2px_var(--card-shadow)] transition-shadow hover:border-[color:var(--card-hover-border)] hover:shadow-[0_6px_20px_var(--card-hover-shadow)] ${dimmed ? "opacity-70" : ""}`}
    >
      <div
        className="w-16 flex-shrink-0 rounded-xl py-[11px] text-center"
        style={past ? { background: "var(--pill-bg)", color: "var(--pill-text)" } : { background: "var(--tile)", color: "#fff" }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: past ? "var(--muted)" : "var(--gold)" }}>{tile.month}</div>
        <div className="text-[24px] font-bold leading-none">{tile.day}</div>
        <div className="text-[11px] font-medium" style={{ color: past ? "var(--muted)" : "var(--nav-muted)" }}>{tile.weekday}</div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-[7px] flex flex-wrap items-center gap-2.5">
          <span className="rounded-md bg-teal-tint px-[9px] py-[3px] text-[12px] font-semibold text-teal">{serviceLabel(a.service)}</span>
          <span className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold tracking-[0.3px]" style={{ background: badge.tintVar, color: badge.colorVar }}>{badge.label}</span>
        </div>
        <h3 className="mb-[9px] line-clamp-1 text-[16px] font-semibold leading-[1.3] text-ink">{a.title || serviceLabel(a.service)}</h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="inline-flex items-center gap-[7px] text-[13px] text-body">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span className="tabular-nums">{time}</span>
          </span>
          <span className="inline-flex items-center gap-[7px] text-[13px] text-body">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--tile)] text-[8px] font-bold text-white">{initialsOf(a.advisorName)}</span>
            {a.advisorName}
          </span>
          <span className="inline-flex items-center gap-[7px] text-[13px] text-body">
            <FormatIcon mode={a.mode} />
            {modeShort(a.mode, a.location)}
          </span>
        </div>
      </div>

      <span className="hidden flex-shrink-0 whitespace-nowrap text-[13px] font-semibold text-ink sm:inline">View <span aria-hidden="true">→</span></span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
      <div className="mx-auto mb-[18px] flex h-[66px] w-[66px] items-center justify-center rounded-[18px] bg-teal-tint">
        <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
      </div>
      <h3 className="mb-2 text-[18px] font-bold text-ink">No appointments in this view</h3>
      <p className="mx-auto mb-5 max-w-[380px] text-[14px] leading-[1.6] text-body">
        Book a one-to-one session with an advisor whenever you&apos;d like to plan your courses, career, or next steps.
      </p>
      <Link href="/appointments/new" className="inline-flex items-center gap-2 rounded-[11px] bg-gold px-[18px] py-3 text-[14px] font-bold text-navy hover:bg-gold-hover">Book advising</Link>
    </div>
  );
}

export function AppointmentsList({ appointments, nowMs }: { appointments: ListAppointment[]; nowMs: number }) {
  const [filter, setFilter] = useState<Filter>("upcoming");

  // "Upcoming" = still attendable (booked + in the future). Cancelled/completed appointments
  // move to "Past" regardless of date, so a cancelled future slot never sits under Upcoming.
  const { upcoming, past } = useMemo(() => {
    const isUpcoming = (a: ListAppointment) => a.status === "booked" && a.startMs >= nowMs;
    const up = appointments.filter(isUpcoming).sort((x, y) => x.startMs - y.startMs);
    const pa = appointments.filter((a) => !isUpcoming(a)).sort((x, y) => y.startMs - x.startMs);
    return { upcoming: up, past: pa };
  }, [appointments, nowMs]);

  const counts = { upcoming: upcoming.length, past: past.length, all: appointments.length };

  const groups: { label: string; items: ListAppointment[]; past: boolean }[] = [];
  if (filter === "upcoming") groups.push({ label: "Upcoming", items: upcoming, past: false });
  else if (filter === "past") groups.push({ label: "Past", items: past, past: true });
  else {
    if (upcoming.length) groups.push({ label: "Upcoming", items: upcoming, past: false });
    if (past.length) groups.push({ label: "Past", items: past, past: true });
  }
  const total = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <div>
      <div className="mb-[22px] inline-flex gap-0.5 rounded-[10px] border border-field bg-card p-1" role="group" aria-label="Filter appointments">
        {TABS.map((t) => {
          const on = filter === t.id;
          return (
            <button key={t.id} type="button" aria-pressed={on} onClick={() => setFilter(t.id)}
              className={`inline-flex items-center rounded-lg px-3.5 py-2 text-[13px] font-semibold ${on ? "bg-gold text-navy" : "bg-transparent text-muted-2"}`}>
              {t.label}
              <span className={`ml-[7px] rounded-full px-[7px] py-px text-[11px] font-bold tabular-nums ${on ? "bg-navy/15 text-navy" : "bg-pill-bg text-pill-text"}`}>{counts[t.id]}</span>
            </button>
          );
        })}
      </div>

      {total > 0 ? (
        <div className="flex flex-col gap-7">
          {groups.map((g) => (
            <section key={g.label}>
              <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.6px] text-muted">{g.label}</div>
              <div className="flex flex-col gap-3.5">
                {g.items.map((a) => (
                  <AppointmentListCard key={a.id} a={a} past={g.past} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
