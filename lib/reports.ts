// Pure, client-safe aggregation for the admin reporting dashboard (US-08). No Firestore, no
// GROUP BY: everything is computed in memory from the ReportDataset so the client can
// re-aggregate as filters change. Type-only import of the dataset shapes (the data module is
// server-only; types are erased). Kept pure so the same functions feed the RSC and the client.
import type { ReportTicket, ReportAppointment } from "@/lib/data/reports";
import { staffCategoryLabel, staffStatusLabel } from "@/lib/labels";

const DAY = 86_400_000;
const OPEN_STATUSES = ["new", "assigned", "waiting_for_student"];
const CHART_CATEGORIES = ["Academic", "Advising", "Records", "Finance", "IT Support", "Career"];
const STATUS_ORDER: { status: string; colorVar: string }[] = [
  { status: "new", colorVar: "var(--chart-gold)" },
  { status: "assigned", colorVar: "var(--chart-navy)" },
  { status: "waiting_for_student", colorVar: "var(--chart-lite)" },
  { status: "resolved", colorVar: "var(--chart-teal)" },
  { status: "closed", colorVar: "var(--field)" },
];

export type DateRangeKey = "30d" | "7d" | "term" | "ytd";
export const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: "30d", label: "Last 30 days" },
  { key: "7d", label: "Last 7 days" },
  { key: "term", label: "This term" },
  { key: "ytd", label: "Year to date" },
];

export interface ReportFilter {
  range: DateRangeKey;
  /** staff category label (e.g. "Advising") or "all" */
  category: string;
  /** advisor uid or "all" */
  advisorId: string;
}

export interface Window {
  startMs: number;
  endMs: number;
  prevStartMs: number;
  prevEndMs: number;
}

export type TrendDir = "up" | "down" | "flat";
export interface Kpi {
  key: string;
  label: string;
  value: string;
  unit: string;
  trend: string;
  dir: TrendDir;
  /** whether the shown direction is a good thing (drives green vs red) */
  good: boolean;
}

export interface LinePoint {
  label: string;
  value: number;
}
export interface DonutSegment {
  status: string;
  label: string;
  value: number;
  colorVar: string;
}
export interface CategoryBar {
  label: string;
  value: number;
  pct: number;
  colorVar: string;
}
export interface AttentionRow {
  id: string;
  code: string;
  title: string;
  category: string;
  owner: string;
  ownerInitials: string;
  unassigned: boolean;
  status: string;
  statusLabel: string;
  ageDays: number;
}

export interface ReportView {
  window: Window;
  rangeLabel: string;
  kpis: Kpi[];
  requestsOverTime: LinePoint[];
  statusDonut: DonutSegment[];
  donutTotal: number;
  categoryBars: CategoryBar[];
  satisfactionTrend: LinePoint[];
  attention: AttentionRow[];
}

/** Resolve a date-range key to a concrete window + the preceding equal-length window. */
export function resolveWindow(range: DateRangeKey, now: number): Window {
  let startMs: number;
  if (range === "7d") startMs = now - 7 * DAY;
  else if (range === "30d") startMs = now - 30 * DAY;
  else if (range === "term") startMs = now - 120 * DAY; // ~one 4-month term
  else {
    const d = new Date(now);
    startMs = new Date(d.getFullYear(), 0, 1).getTime(); // Jan 1
  }
  const len = now - startMs;
  return { startMs, endMs: now, prevStartMs: startMs - len, prevEndMs: startMs };
}

function inWin(ms: number | null, s: number, e: number): boolean {
  return ms != null && ms >= s && ms < e;
}
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]!).join("").slice(0, 2).toUpperCase();
}
function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/** Apply the category + advisor filters (NOT the date window) to the ticket set. */
function scopeTickets(tickets: ReportTicket[], filter: ReportFilter): ReportTicket[] {
  return tickets.filter((t) => {
    if (filter.category !== "all" && staffCategoryLabel(t.category) !== filter.category) return false;
    if (filter.advisorId !== "all" && t.assigneeId !== filter.advisorId) return false;
    return true;
  });
}

function pctDelta(cur: number, prev: number): { text: string; dir: TrendDir } {
  if (prev === 0) return { text: cur === 0 ? "no change vs prior" : "new this period", dir: "flat" };
  const delta = (cur - prev) / prev;
  const dir: TrendDir = delta > 0.005 ? "up" : delta < -0.005 ? "down" : "flat";
  return { text: `${Math.abs(Math.round(delta * 100))}% vs prior period`, dir };
}

/** The whole dashboard view for a given dataset + filter + "now". Pure. */
export function buildReportView(
  tickets: ReportTicket[],
  appointments: ReportAppointment[],
  filter: ReportFilter,
  now: number,
): ReportView {
  const w = resolveWindow(filter.range, now);
  const scoped = scopeTickets(tickets, filter);

  const createdIn = (s: number, e: number) => scoped.filter((t) => inWin(t.createdAtMs, s, e));
  const resolvedIn = (s: number, e: number) => scoped.filter((t) => inWin(t.resolvedAtMs, s, e));

  // ---- KPIs ----
  const openCur = createdIn(w.startMs, w.endMs).filter((t) => OPEN_STATUSES.includes(t.status)).length;
  const openPrev = createdIn(w.prevStartMs, w.prevEndMs).filter((t) => OPEN_STATUSES.includes(t.status)).length;
  const openTrend = pctDelta(openCur, openPrev);

  const resolvedCur = resolvedIn(w.startMs, w.endMs);
  const avgDays = (rows: ReportTicket[]) => {
    const durs = rows
      .filter((t) => t.resolvedAtMs != null && t.createdAtMs != null)
      .map((t) => (t.resolvedAtMs! - t.createdAtMs!) / DAY);
    return durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
  };
  const avgCur = avgDays(resolvedCur);
  const avgPrev = avgDays(resolvedIn(w.prevStartMs, w.prevEndMs));
  const avgDelta = avgPrev ? avgCur - avgPrev : 0;

  const apptScope = (s: number, e: number) =>
    appointments.filter(
      (a) =>
        a.status !== "cancelled" &&
        inWin(a.startMs, s, e) &&
        (filter.advisorId === "all" || a.advisorId === filter.advisorId),
    ).length;
  const apptCur = apptScope(w.startMs, w.endMs);
  const apptTrend = pctDelta(apptCur, apptScope(w.prevStartMs, w.prevEndMs));

  const rated = resolvedCur.filter((t) => t.rating != null);
  const satAvg = rated.length ? rated.reduce((a, t) => a + (t.rating ?? 0), 0) / rated.length : 0;

  const kpis: Kpi[] = [
    {
      key: "open",
      label: "Open requests",
      value: String(openCur),
      unit: "",
      trend: openTrend.text,
      dir: openTrend.dir,
      good: openTrend.dir === "down", // fewer open is good
    },
    {
      key: "resolve",
      label: "Avg. time to resolve",
      value: avgCur ? round1(avgCur) : "—",
      unit: avgCur ? "days" : "",
      trend: avgPrev ? `${round1(Math.abs(avgDelta))} days ${avgDelta <= 0 ? "faster" : "slower"}` : "no prior data",
      dir: avgDelta < 0 ? "down" : avgDelta > 0 ? "up" : "flat",
      good: avgDelta <= 0, // faster is good
    },
    {
      key: "appts",
      label: "Appointments booked",
      value: String(apptCur),
      unit: "",
      trend: apptTrend.text,
      dir: apptTrend.dir,
      good: apptTrend.dir !== "down", // more booked is good/neutral
    },
    {
      key: "sat",
      label: "Student satisfaction",
      value: rated.length ? round1(satAvg) : "—",
      unit: rated.length ? "/ 5" : "",
      trend: rated.length ? `from ${rated.length} response${rated.length === 1 ? "" : "s"}` : "no ratings yet",
      dir: "flat",
      good: true,
    },
  ];

  // ---- Requests over time (daily counts across the window) ----
  const dayStart = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const requestsOverTime: LinePoint[] = [];
  const firstDay = dayStart(w.startMs);
  const dayCount = Math.max(1, Math.min(200, Math.round((w.endMs - firstDay) / DAY) + 1));
  const createdWin = createdIn(w.startMs, w.endMs);
  for (let i = 0; i < dayCount; i++) {
    const s = firstDay + i * DAY;
    const e = s + DAY;
    const d = new Date(s);
    requestsOverTime.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      value: createdWin.filter((t) => inWin(t.createdAtMs, s, e)).length,
    });
  }

  // ---- Status donut (over tickets created in the window) ----
  const donutSource = createdWin;
  const statusDonut: DonutSegment[] = STATUS_ORDER.map((s) => ({
    status: s.status,
    label: staffStatusLabel(s.status),
    value: donutSource.filter((t) => t.status === s.status).length,
    colorVar: s.colorVar,
  }));
  const donutTotal = statusDonut.reduce((a, s) => a + s.value, 0);

  // ---- Category bars (over tickets created in the window) ----
  const catCounts = CHART_CATEGORIES.map((label) => ({
    label,
    value: donutSource.filter((t) => staffCategoryLabel(t.category) === label).length,
  })).filter((b) => b.value > 0);
  const maxBar = Math.max(1, ...catCounts.map((b) => b.value));
  const categoryBars: CategoryBar[] = catCounts
    .sort((a, b) => b.value - a.value)
    .map((b, i) => ({
      ...b,
      pct: Math.round((b.value / maxBar) * 100),
      colorVar: i === 0 ? "var(--chart-gold)" : "var(--chart-teal)",
    }));

  // ---- Satisfaction trend (avg rating per week across the window) ----
  const satisfactionTrend: LinePoint[] = [];
  const weeks = Math.max(1, Math.min(16, Math.ceil((w.endMs - w.startMs) / (7 * DAY))));
  for (let i = 0; i < weeks; i++) {
    const s = w.startMs + i * 7 * DAY;
    const e = Math.min(w.endMs, s + 7 * DAY);
    const wk = scoped.filter((t) => t.rating != null && inWin(t.resolvedAtMs, s, e));
    const avg = wk.length ? wk.reduce((a, t) => a + (t.rating ?? 0), 0) / wk.length : 0;
    satisfactionTrend.push({ label: `W${i + 1}`, value: Math.round(avg * 100) / 100 });
  }

  // ---- Needs attention (live open list, category/advisor scoped, oldest by age) ----
  const attention: AttentionRow[] = scoped
    .filter((t) => OPEN_STATUSES.includes(t.status))
    .map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      category: staffCategoryLabel(t.category),
      owner: t.assigneeName ?? "Unassigned",
      ownerInitials: t.assigneeName ? initialsOf(t.assigneeName) : "—",
      unassigned: !t.assigneeId,
      status: t.status,
      statusLabel: staffStatusLabel(t.status),
      ageDays: t.createdAtMs != null ? Math.floor((now - t.createdAtMs) / DAY) : 0,
    }))
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 6);

  return {
    window: w,
    rangeLabel: DATE_RANGES.find((r) => r.key === filter.range)?.label ?? "Last 30 days",
    kpis,
    requestsOverTime,
    statusDonut,
    donutTotal,
    categoryBars,
    satisfactionTrend,
    attention,
  };
}

/** Staleness color for an age-in-days cell (matches the mockup). */
export function ageColorVar(days: number): string {
  return days >= 7 ? "var(--up)" : days >= 5 ? "var(--gold-ink)" : "var(--body)";
}

/** The advisor options for the filter, derived from tickets' denormalized assignee names. */
export function advisorOptions(tickets: ReportTicket[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const t of tickets) {
    if (t.assigneeId && t.assigneeName && !seen.has(t.assigneeId)) seen.set(t.assigneeId, t.assigneeName);
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
