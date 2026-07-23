"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReportTicket, ReportAppointment } from "@/lib/data/reports";
import {
  advisorOptions,
  ageColorVar,
  buildReportView,
  DATE_RANGES,
  type DateRangeKey,
  type Kpi,
  type ReportFilter,
} from "@/lib/reports";
import { RequestsLineChart, SatisfactionChart, StatusDonut } from "@/components/admin/charts";

const CATEGORY_OPTIONS = ["Academic", "Advising", "Records", "Finance", "IT Support", "Career"];

export function ReportsDashboard({
  tickets,
  appointments,
  nowMs,
}: {
  tickets: ReportTicket[];
  appointments: ReportAppointment[];
  nowMs: number;
}) {
  const [range, setRange] = useState<DateRangeKey>("30d");
  const [category, setCategory] = useState("all");
  const [advisorId, setAdvisorId] = useState("all");

  const advisors = useMemo(() => advisorOptions(tickets), [tickets]);
  const view = useMemo(() => {
    const filter: ReportFilter = { range, category, advisorId };
    return buildReportView(tickets, appointments, filter, nowMs);
  }, [tickets, appointments, range, category, advisorId, nowMs]);

  const advisorName = advisors.find((a) => a.id === advisorId)?.name;
  const subtitle = `Program-wide support metrics${category !== "all" ? ` · ${category}` : " · all categories"} · ${view.rangeLabel}`;

  function exportCsv() {
    const rows: string[][] = [
      ["CampusConnect — Reports", subtitle],
      [],
      ["KPI", "Value", "Trend"],
      ...view.kpis.map((k) => [k.label, `${k.value}${k.unit ? " " + k.unit : ""}`, k.trend]),
      [],
      ["Requests needing attention"],
      ["Request", "Code", "Category", "Owner", "Status", "Age (days)"],
      ...view.attention.map((r) => [r.title, r.code, r.category, r.owner, r.statusLabel, String(r.ageDays)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campusconnect-report-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* HEADER */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-[5px] text-[27px] font-bold text-ink">Reports &amp; insight</h1>
          <p className="text-[14.5px] text-body">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-[10px] border border-field bg-card px-4 py-2.5 text-[13.5px] font-semibold text-ink hover:border-[color:var(--muted)]"
        >
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Export report
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-card p-4 shadow-[0_1px_2px_var(--card-shadow)]">
        <span className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.5px] text-muted">
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          Filters
        </span>
        <Select label="Date range" value={range} onChange={(v) => setRange(v as DateRangeKey)}
          options={DATE_RANGES.map((r) => ({ v: r.key, l: r.label }))} />
        <Select label="Category" value={category} onChange={setCategory}
          options={[{ v: "all", l: "All categories" }, ...CATEGORY_OPTIONS.map((c) => ({ v: c, l: c }))]} />
        <Select label="Advisor" value={advisorId} onChange={setAdvisorId}
          options={[{ v: "all", l: "All advisors" }, ...advisors.map((a) => ({ v: a.id, l: a.name }))]} />
        <div className="hidden h-[26px] w-px bg-divider sm:block" />
        <div className="inline-flex gap-0.5 rounded-[9px] border border-field bg-page p-[3px]">
          <QuickTab active={category === "all"} onClick={() => setCategory("all")} label="All categories" />
          <QuickTab active={category === "Advising"} onClick={() => setCategory("Advising")} label="Advising only" />
        </div>
      </div>

      {/* ACTIVE FILTERS */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <span className="text-[12px] font-bold uppercase tracking-[0.5px] text-muted">Active filters</span>
        <FilterChip dimension="Date range" value={view.rangeLabel} locked />
        {category !== "all" ? <FilterChip dimension="Category" value={category} onRemove={() => setCategory("all")} accent /> : null}
        {advisorId !== "all" && advisorName ? <FilterChip dimension="Advisor" value={advisorName} onRemove={() => setAdvisorId("all")} accent /> : null}
        {category !== "all" || advisorId !== "all" ? (
          <button type="button" onClick={() => { setCategory("all"); setAdvisorId("all"); }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-teal hover:text-ink">
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
            Clear all
          </button>
        ) : null}
      </div>

      {/* KPI CARDS */}
      <div className="mb-5 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2">
        {view.kpis.map((k) => <KpiCard key={k.key} kpi={k} />)}
      </div>

      {/* CHARTS GRID */}
      <div className="mb-5 grid grid-cols-[1.6fr_1fr] gap-4 max-[900px]:grid-cols-1">
        {/* requests over time */}
        <ChartCard>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-ink">Requests over time</h2>
            <span className="text-[12px] text-muted">Daily · {view.rangeLabel.toLowerCase()}</span>
          </div>
          <p className="mb-3.5 text-[13px] text-body">New requests submitted per day over the selected period.</p>
          <RequestsLineChart data={view.requestsOverTime} />
        </ChartCard>

        {/* status donut */}
        <ChartCard>
          <h2 className="mb-4 text-[16px] font-bold text-ink">Status breakdown</h2>
          <div className="flex flex-wrap items-center gap-[18px]">
            <StatusDonut segments={view.statusDonut} total={view.donutTotal} />
            <div className="flex min-w-[130px] flex-1 flex-col gap-[9px]">
              {view.statusDonut.map((s) => (
                <div key={s.status} className="flex items-center gap-[9px]">
                  <span aria-hidden="true" className="h-[11px] w-[11px] flex-shrink-0 rounded-[3px]" style={{ background: s.colorVar }} />
                  <span className="flex-1 text-[13px] text-body">{s.label}</span>
                  <span className="text-[13px] font-bold text-ink tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* category bars (CSS track bars — the mockup's design) */}
        <ChartCard>
          <h2 className="mb-4 text-[16px] font-bold text-ink">Requests by category</h2>
          {view.categoryBars.length ? (
            <div className="flex flex-col gap-[13px]">
              {view.categoryBars.map((b) => (
                <div key={b.label}>
                  <div className="mb-[5px] flex items-center justify-between">
                    <span className="text-[13px] font-medium text-ink">{b.label}</span>
                    <span className="text-[13px] font-bold text-ink tabular-nums">{b.value}</span>
                  </div>
                  <div className="h-[9px] overflow-hidden rounded-md bg-[color:var(--chart-track)]">
                    <div className="h-full rounded-md" style={{ width: `${b.pct}%`, background: b.colorVar }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-[13px] text-muted">No requests in this period.</p>
          )}
        </ChartCard>

        {/* satisfaction trend */}
        <ChartCard>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-ink">Satisfaction trend</h2>
            <span className="text-[12px] text-muted">Avg / week</span>
          </div>
          <p className="mb-3.5 text-[13px] text-body">Average student rating, scale 1–5.</p>
          <SatisfactionChart data={view.satisfactionTrend} />
        </ChartCard>
      </div>

      {/* NEEDS ATTENTION */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_1px_2px_var(--card-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-[22px] py-[18px]">
          <div>
            <h2 className="text-[16px] font-bold text-ink">Requests needing attention</h2>
            <p className="mt-0.5 text-[13px] text-body">Oldest still-open requests, by age.</p>
          </div>
          <Link href="/staff/triage" className="text-[13px] font-semibold text-teal hover:text-ink">Open triage board <span aria-hidden="true">→</span></Link>
        </div>
        <div className="grid grid-cols-[2.4fr_1fr_1.3fr_1.4fr_0.8fr] gap-3.5 border-b border-line bg-[color:var(--head-bg)] px-[22px] py-3 text-[11px] font-bold uppercase tracking-[0.5px] text-muted max-[760px]:grid-cols-[2fr_1.2fr_0.7fr]">
          <span>Request</span>
          <span className="max-[760px]:hidden">Category</span>
          <span className="max-[760px]:hidden">Owner</span>
          <span>Status</span>
          <span className="text-right">Age</span>
        </div>
        {view.attention.length ? (
          view.attention.map((r) => (
            <Link key={r.id} href={`/staff/requests/${r.id}`} className="grid grid-cols-[2.4fr_1fr_1.3fr_1.4fr_0.8fr] items-center gap-3.5 border-b border-divider px-[22px] py-[15px] hover:bg-[color:var(--divider)] max-[760px]:grid-cols-[2fr_1.2fr_0.7fr]">
              <div className="min-w-0 text-[14px] font-semibold leading-[1.3] text-ink">
                <span className="line-clamp-1">{r.title}</span>
              </div>
              <span className="w-fit rounded-[5px] bg-teal-tint px-[9px] py-[3px] text-[12px] font-semibold text-teal max-[760px]:hidden">{r.category}</span>
              <span className="inline-flex items-center gap-2 max-[760px]:hidden">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold" style={r.unassigned ? { border: "1.5px dashed var(--field)", color: "var(--muted)" } : { background: "var(--tile)", color: "#fff" }}>{r.ownerInitials}</span>
                <span className="text-[13px] text-ink">{r.owner}</span>
              </span>
              <span className="inline-flex w-fit items-center rounded-full bg-pill-bg px-[11px] py-[5px] text-[12px] font-semibold text-pill-text">{r.statusLabel}</span>
              <span className="text-right text-[13px] font-bold tabular-nums" style={{ color: ageColorVar(r.ageDays) }}>{r.ageDays}d</span>
            </Link>
          ))
        ) : (
          <p className="px-[22px] py-10 text-center text-[13.5px] text-muted">Nothing needs attention in this view — every open request is fresh.</p>
        )}
      </div>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const trendColor = kpi.dir === "flat" ? "var(--muted)" : kpi.good ? "var(--down)" : "var(--up)";
  return (
    <div className="rounded-[15px] border border-line bg-card px-[22px] py-5 shadow-[0_1px_2px_var(--card-shadow)]">
      <div className="mb-3.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-muted-2">{kpi.label}</span>
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-teal-tint">
          <KpiIcon k={kpi.key} />
        </span>
      </div>
      <div className="text-[30px] font-extrabold leading-none tracking-[-0.5px] text-ink tabular-nums">
        {kpi.value}
        {kpi.unit ? <span className="ml-[3px] text-[15px] font-semibold text-muted">{kpi.unit}</span> : null}
      </div>
      <div className="mt-[9px] flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: trendColor }}>
        <TrendArrow dir={kpi.dir} />
        <span>{kpi.trend}</span>
      </div>
    </div>
  );
}

function KpiIcon({ k }: { k: string }) {
  const p = { "aria-hidden": true as const, width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "var(--teal)", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (k === "open") return <svg {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>;
  if (k === "resolve") return <svg {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
  if (k === "appts") return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
  return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
}

function TrendArrow({ dir }: { dir: string }) {
  if (dir === "flat") return null;
  const p = { "aria-hidden": true as const, width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return dir === "up"
    ? <svg {...p}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
    : <svg {...p}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>;
}

function ChartCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-card px-6 py-[22px] shadow-[0_1px_2px_var(--card-shadow)]">{children}</div>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="relative inline-flex items-center">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-[9px] border border-field bg-[color:var(--field-bg)] py-2 pl-[13px] pr-[30px] text-[13px] font-medium text-ink">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-2.5"><polyline points="6 9 12 15 18 9" /></svg>
    </div>
  );
}

function QuickTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`rounded-[7px] px-[13px] py-[7px] text-[12.5px] font-semibold ${active ? "bg-gold text-navy" : "bg-transparent text-muted-2"}`}>
      {label}
    </button>
  );
}

function FilterChip({ dimension, value, locked, accent, onRemove }: { dimension: string; value: string; locked?: boolean; accent?: boolean; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border py-1.5 pl-3 pr-2 text-[12.5px] font-semibold"
      style={accent ? { background: "var(--teal-tint)", borderColor: "var(--teal)", color: "var(--teal)" } : { background: "var(--pill-bg)", borderColor: "var(--border)", color: "var(--pill-text)" }}
    >
      <span className="text-[10.5px] font-bold uppercase tracking-[0.3px] opacity-70">{dimension}</span>
      {value}
      {locked ? (
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-55"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
      ) : onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Remove ${dimension} filter`} className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full hover:bg-black/10">
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      ) : null}
    </span>
  );
}
