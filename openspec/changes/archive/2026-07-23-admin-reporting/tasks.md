## 1. Data + aggregation

- [x] 1.1 Add `recharts` to `package.json` (dependency).
- [x] 1.2 `lib/data/reports.ts` — `getReportDataset()`: one bounded fetch of all tickets
      (`orderBy("createdAt","desc") limit N`) + all appointments via `FirebaseServerApp`, mapped
      to serializable rows (ticket: status, category, priority, assigneeId/Name, studentName,
      code, title, createdAtMs, resolvedAtMs, rating; appt: startMs, status, service, advisorId).
      Return `{ tickets, appointments, error }`.
- [x] 1.3 `lib/reports.ts` (pure, client-safe) — types + aggregation helpers over
      `(dataset, filter)`: date-range → `[startMs,endMs]` (30d/7d/term/YTD from `now`), the 4
      KPIs + prior-period trend, the 4 chart series (daily requests, status donut, category bars,
      weekly satisfaction), and the needs-attention list (oldest open, by age). Neutral trend on
      empty prior window.

## 2. Dashboard UI (`/admin/reports`)

- [x] 2.1 Replace the stub `app/(admin)/admin/reports/page.tsx` with an RSC: compute `nowMs`
      once, call `getReportDataset()`, handle the error state, and pass the serializable dataset
      + `nowMs` to a client dashboard component (header + "Export report").
- [x] 2.2 `components/admin/reports-dashboard.tsx` (client): filter state (date range / category /
      advisor) + active-filter chips; recomputes KPIs/charts/table via `lib/reports.ts`.
- [x] 2.3 KPI cards (4) with value + prior-period trend indicator (up/down/neutral).
- [x] 2.4 Charts (Recharts client leaves in `components/admin/charts/`): Requests over time
      (line), Status breakdown (donut w/ center total), Requests by category (bars), Satisfaction
      trend (line, 1–5). Colors = theme tokens; `ResponsiveContainer` with explicit heights.
- [x] 2.5 Requests-needing-attention table: oldest open by age (Request/Category/Owner/Status/
      Age), staleness-colored age, rows link to the triage board.
- [x] 2.6 Export report: client-side CSV of the filtered KPIs + attention rows (real download).

## 3. Nav + seed

- [x] 3.1 Remove the `Users → /admin/users` link from the admin nav in `components/nav/top-nav.tsx`.
- [x] 3.2 Extend `functions/src/scripts/seedData.ts`: set `rating` (1–5) on resolved/closed
      tickets and spread ticket `createdAt`/`resolvedAt` across several weeks so the over-time +
      satisfaction charts have shape. Rebuild `functions/lib` and run the seed.

## 4. Verify (UI build & comparison-check — BOTH light and dark)

- [x] 4.1 Pull the `Admin Dashboard.dc.html` mockup via DesignSync; adopt its tokens/layout;
      diff region-by-region (KPI cards + trends, the 4 charts, filter chips, attention table).
- [x] 4.2 Run the app (Playwright) signed in as `admin@myibu.ca`; screenshot the dashboard in
      **light AND dark**; confirm charts are legible and token-colored in both; fix drift.
- [x] 4.3 `web-design-guidelines` pass: chart accessibility (titles, `aria-label`/text
      alternative for each chart), `:focus-visible`, `aria-hidden` on decorative glyphs, keyboard
      order, `tabular-nums` on figures, reduced-motion, filter selects labelled.
- [x] 4.4 Verify filters recompute every KPI/chart/table, the trend handles a sparse prior
      window (neutral "—"), and Export downloads a CSV of the filtered view.
- [x] 4.5 `pnpm lint` + `pnpm build` clean (watch `react-hooks/purity` — `nowMs()` wrapper); then
      mark the UI tasks done and record any justified deviation.
