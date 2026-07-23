"use client";

// Recharts chart leaves for the admin reporting dashboard (US-08). Colors are semantic theme
// tokens (var(--chart-*) / var(--grid)) passed as SVG stroke/fill, so the charts flip in
// light/dark with the root data-theme marker — no JS theme listener. Each chart is wrapped with
// role="img" + an aria-label text alternative (the SVG itself is decorative to AT).
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DonutSegment, LinePoint } from "@/lib/reports";

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--ink)",
  boxShadow: "0 4px 14px var(--card-shadow)",
} as const;

export function RequestsLineChart({ data }: { data: LinePoint[] }) {
  const total = data.reduce((a, p) => a + p.value, 0);
  return (
    <div className="h-[220px] w-full" role="img" aria-label={`Requests over time: ${total} requests across ${data.length} days.`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={{ stroke: "var(--grid)" }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} width={34} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--grid)" }} labelStyle={{ color: "var(--muted)" }} />
          <Area type="monotone" dataKey="value" name="Requests" stroke="var(--chart-navy)" strokeWidth={2.4} fill="var(--chart-navy)" fillOpacity={0.12} isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: "var(--chart-navy)" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SatisfactionChart({ data }: { data: LinePoint[] }) {
  const avg = data.length ? (data.reduce((a, p) => a + p.value, 0) / data.length).toFixed(1) : "—";
  return (
    <div className="h-[150px] w-full" role="img" aria-label={`Satisfaction trend: average rating ${avg} out of 5 across ${data.length} weeks.`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={{ stroke: "var(--grid)" }} />
          <YAxis domain={[3, 5]} ticks={[3, 4, 5]} tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} width={30} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--grid)" }} labelStyle={{ color: "var(--muted)" }} formatter={(v) => [Number(v).toFixed(2), "Avg rating"]} />
          <Area type="monotone" dataKey="value" name="Avg rating" stroke="var(--chart-gold)" strokeWidth={2.4} fill="var(--chart-gold)" fillOpacity={0.14} isAnimationActive={false} dot={{ r: 2.5, fill: "var(--chart-gold)" }} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDonut({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const label = segments.map((s) => `${s.label} ${s.value}`).join(", ");
  return (
    <div className="relative h-[150px] w-[150px] flex-shrink-0" role="img" aria-label={`Status breakdown, ${total} total: ${label}.`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={segments} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={48} outerRadius={64} startAngle={90} endAngle={-270} stroke="none" paddingAngle={total > 0 ? 1 : 0} isAnimationActive={false}>
            {segments.map((s) => (
              <Cell key={s.status} fill={s.colorVar} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[26px] font-extrabold leading-none text-ink tabular-nums">{total}</div>
        <div className="text-[11px] text-muted">total</div>
      </div>
    </div>
  );
}
