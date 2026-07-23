## Context

The student spine (US-01…06) and the staff surface (US-07) are complete; `/admin/reports` is
still a stub. Admins are a superset of staff, so under the existing `firestore.rules` they can
read every ticket, appointment, and user. US-08 turns that into a program-wide reporting
dashboard. Established constraints carry over: reads via `FirebaseServerApp` (never the Admin
SDK on Vercel — ADR-0004), bounded single-fetch + in-memory aggregation (no `GROUP BY`), keep
the client boundary at leaves so gated/dynamic pages don't drag static ones, and verify UI in
both themes against the mockup.

## Goals / Non-Goals

**Goals:**
- `/admin/reports`: 4 KPI cards (with prior-period trend), 4 charts, a needs-attention table,
  and date/category/advisor filters — all over **real, in-memory-aggregated** data.
- Recharts for the charts, theme-aware in light/dark.
- Client-side CSV export of the filtered view.

**Non-Goals:**
- The Users / role-management screen (deferred — role changes can't be written from the web in
  this MVP; stays the `setRole` CLI). Drop the dangling admin "Users" nav link.
- A post-resolution rating-collection UI — `rating` is seeded onto tickets for now.
- Any precomputed `reports` document, scheduled aggregation, or Cloud Function.
- New Firestore indexes, rules, or data-model fields (`rating` already exists on tickets).

## Decisions

### 1. In-memory aggregation over a bounded admin read

`lib/data/reports.ts` does one bounded fetch of all tickets (`orderBy("createdAt","desc")
limit N`, automatic single-field index) + all appointments, maps them to serializable rows, and
returns a `ReportDataset` (the raw rows the client needs). **Aggregation is pure and runs
client-side** so the filters can re-aggregate without refetching: KPIs, the four chart series,
and the attention list are computed by pure functions in `lib/reports.ts` from the dataset + the
active filter. "Now" is computed once in the RSC and passed down (the `nowMs()` purity pattern)
so period math can't drift.

- *Why client-side aggregation:* the date/category/advisor filters must recompute everything;
  fetching once and aggregating in memory (the dataset is MVP-small) beats a server round-trip
  per filter and reuses the US-05/07 "single fetch, filter in memory" convention.
- *Trade-off:* a bounded cap (`N` ~1000 tickets) could truncate at very large volume — `log`/
  note it; revisit with server-side aggregation only if real volume demands it.
- *Alternative — precomputed/seeded `reports` doc:* rejected. Fake numbers, decorative filters,
  and a staleness problem; in-memory over real data is strictly better at MVP scale.

### 2. Recharts, fed serializable series, colored with theme tokens

Charts are `"use client"` leaves (`components/admin/charts/*`) wrapped in Recharts
`ResponsiveContainer`. The RSC/aggregation passes plain `{label, value}[]` series; the client
components own only presentation. Colors are the semantic theme tokens (`var(--teal)`,
`var(--pri-*)`, status/category colors) passed as `fill`/`stroke`, so charts flip with the
`data-theme` root marker in light/dark — no JS theme listener. A thin client wrapper isolates
Recharts so `/login` and other static pages never import it.

- *Alternative — hand-rolled SVG/CSS:* viable and dependency-free, but the user chose Recharts
  for faster, richer charts; the cost is one client dep (~scoped to `/admin/reports`) + token
  wiring, accepted.
- *Risk:* Recharts + React 19 peer-dep/SSR quirks → keep charts client-only (no SSR of the
  chart internals), give `ResponsiveContainer` an explicit height, and verify hydration is clean.

### 3. Filters + trend windows

Filter state lives in a client dashboard component. Date range maps to a concrete
`[startMs, endMs]`; "This term" and "Year to date" derive from `now`. Every KPI/chart/table is a
pure function of `(dataset, filter)`. The KPI trend compares the selected window against the
immediately preceding window of equal length (same category/advisor filter) — a percentage/delta
with an up/down indicator.

### 4. Seeded `rating` + historical spread

No UI collects satisfaction, so `seedData.ts` sets `rating` (1–5) on resolved/closed tickets and
spreads ticket `createdAt`/`resolvedAt` across several weeks so "Requests over time" and
"Satisfaction trend" have shape. This is the only seeded reporting input; all other metrics come
from real data.

### 5. Defer Users; remove the dangling nav link

Web role management needs the Admin SDK (forbidden on Vercel) or a deployed callable (none in the
MVP). So US-08 ships no Users screen; the admin nav in `components/nav/top-nav.tsx` drops its
`Users → /admin/users` link (it would 404). Role changes remain the documented `setRole` CLI.

## Risks / Trade-offs

- **Bounded read cap** → truncates beyond `N`; log the cap, MVP-acceptable.
- **Recharts client dep / SSR** → charts client-only with fixed container heights; verify no
  hydration mismatch and that token colors resolve in both themes.
- **Seeded satisfaction** → the satisfaction KPI/trend is demo data until a rating-collection UI
  exists; called out in the seed + the dashboard copy if needed.
- **Trend on sparse data** → a prior window with no tickets makes a trend undefined; render a
  neutral "—" rather than a divide-by-zero or a misleading ∞.

## Migration Plan

1. Add `recharts`; build `lib/data/reports.ts` + pure `lib/reports.ts` aggregation.
2. Replace the reports stub with the RSC + client dashboard; drop the Users nav link.
3. Extend the seed (ratings + historical spread) and run it against the real project.
4. Verify KPIs/charts/table/filters/export + both themes (Playwright) against the Admin
   Dashboard mockup. No rules/index deploy needed.

## Open Questions

- None blocking. If satisfaction ever needs to be real, add a post-resolution rating step on the
  student ticket detail (a small follow-up) — the KPI already reads `rating`.
