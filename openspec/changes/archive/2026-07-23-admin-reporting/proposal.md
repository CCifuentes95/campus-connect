## Why

Admins can work the queue (US-07) but have no program-wide view — no way to see open-request
volume, how fast requests resolve, appointment throughput, satisfaction, or which requests are
going stale. US-08 delivers the admin reporting dashboard: KPIs, charts, and a needs-attention
list over real data. It's the last screen in the build order and turns the finished student +
staff spine into something a program office can actually monitor.

## What Changes

- **Admin reporting dashboard** (`/admin/reports`, admin-gated): replaces the stub with 4 KPI
  cards (Open requests, Avg. time to resolve, Appointments booked, Student satisfaction) each
  with a trend vs. the prior period; 4 charts (Requests over time, Status breakdown donut,
  Requests by category bars, Satisfaction trend); and a **Requests needing attention** table
  (oldest still-open requests by age, linking to the triage board).
- **Real data, not seeded KPIs**: a bounded admin read of all tickets + appointments (admin
  reads all under existing rules — no Admin SDK) aggregated **in memory** (`lib/data/reports.ts`).
  Firestore has no `GROUP BY`, so the app's established bounded-fetch + in-memory pattern
  (US-02/05/07) computes every metric and chart series — a deliberate improvement over the
  brief's "seed the KPIs" suggestion. The only seeded value is `rating` (no rating-collection
  UI exists), added to resolved/closed tickets in the seed script.
- **Working filters**: date range (Last 30 days / 7 days / This term / Year to date), category,
  and advisor — applied in memory client-side; KPIs, charts, and the table re-aggregate on
  change. Trend-vs-prior compares the selected window to the immediately preceding equal-length window.
- **Charts via Recharts**: the 4 charts are Recharts client-leaf components fed serializable
  series from the RSC; colored with theme tokens so they flip in light/dark. **New dependency:** `recharts`.
- **Export report**: a lightweight client-side CSV export of the current (filtered) KPIs +
  attention table — a real download, not a stub.
- **Defer the Users / role-management screen**: custom claims can only be set via the Admin SDK
  (forbidden on Vercel — ADR-0004) and no Cloud Functions are deployed, so web-based role
  management isn't buildable in the MVP. Role changes stay the documented `setRole` CLI; the
  dangling "Users" link is removed from the admin nav.

## Capabilities

### New Capabilities
- `admin-reporting`: the admin reporting dashboard — KPI cards with prior-period trends, the
  four charts, the needs-attention table, the in-memory aggregation over a rules-scoped admin
  read, the date/category/advisor filters, and CSV export.

### Modified Capabilities
<!-- None. The admin nav "Users" link is dropped (implementation), and role management stays the
     existing setRole CLI — no spec-level behavior of an existing capability changes. -->

## Impact

- **Routes/UI:** replace `app/(admin)/admin/reports/page.tsx` (stub → RSC); new
  `components/admin/*` (KPI cards, chart leaves, attention table, filters, export button).
- **Data:** new `lib/data/reports.ts` (one admin read + pure aggregation into serializable
  KPI/series/attention shapes). Reporting label/period helpers in `lib/labels.ts` as needed.
- **Nav:** drop the "Users" link from the admin nav in `components/nav/top-nav.tsx`.
- **Seed:** `functions/src/scripts/seedData.ts` — add `rating` to resolved/closed tickets and
  enough historical spread (createdAt/resolvedAt across weeks) for meaningful charts.
- **Deps:** add `recharts`. No `firestore.rules`, data-model, or index change (admin reads use
  the automatic single-field `createdAt` index; admin already reads all collections).
- **Depends on:** US-07 (tickets/appointments + staff surface exist). Admin gating built in US-01.
