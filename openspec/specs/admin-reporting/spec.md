# admin-reporting Specification

## Purpose
The admin reporting capability: a program-wide dashboard at `/admin/reports` (admin-gated) that reads all tickets + appointments through `FirebaseServerApp` under the signed-in admin (rules already permit admin — as staff — to read every ticket/appointment; no Admin SDK) and aggregates them **in memory** — no `GROUP BY`, no precomputed report document. It shows four KPI cards with prior-period trends, four charts (requests over time, status donut, category bars, satisfaction trend), and a needs-attention table of the oldest still-open requests; date/category/advisor filters re-aggregate everything client-side, and the current view exports to CSV. Satisfaction is seeded onto tickets (`rating`) until a rating-collection UI exists; every other metric is real. Role management (Users) is deferred — custom claims can only be set via the Admin SDK / a callable, neither available on Vercel in this MVP (ADR-0004); roles stay the `setRole` CLI.

## Requirements

### Requirement: Admin reporting access

The admin reporting dashboard SHALL live at `/admin/reports` and be admin-gated — a non-admin
reaching it is redirected to their role home. The dashboard SHALL read all tickets and all
appointments through `FirebaseServerApp` under the signed-in admin's own credentials (rules
already permit admin — as staff — to read every ticket and appointment; no Admin SDK). The read
SHALL be a single bounded fetch per collection, aggregated in memory (no `GROUP BY`, no
precomputed report document). The dashboard SHALL distinguish a data-read failure from an
empty-data state.

#### Scenario: A non-admin cannot reach the dashboard

- **WHEN** a signed-in student or advisor navigates to `/admin/reports`
- **THEN** they are redirected to their role home and do not see the reporting dashboard

#### Scenario: Metrics are computed from real data

- **WHEN** an admin opens the dashboard
- **THEN** the KPIs, charts, and needs-attention table reflect the actual tickets and
  appointments in Firestore (not seeded constants), aggregated in memory

#### Scenario: Read failure is distinguished from empty

- **WHEN** the reporting read fails
- **THEN** the dashboard shows an error state distinct from a legitimately empty dataset

### Requirement: KPI cards with prior-period trend

The dashboard SHALL show four KPI cards computed over the selected period: **Open requests**
(count of non-closed tickets), **Avg. time to resolve** (mean `resolvedAt − createdAt` over
tickets resolved in the period, in days), **Appointments booked** (count of appointments whose
`start` falls in the period), and **Student satisfaction** (mean `rating`, 1–5). Each card SHALL
show a trend indicator comparing its value to the immediately preceding equal-length window.

#### Scenario: KPI values reflect the selected period

- **WHEN** an admin views the KPI cards for a given date range
- **THEN** each KPI is computed over that range and its trend compares to the preceding
  equal-length window

#### Scenario: Avg time-to-resolve uses resolved tickets

- **WHEN** the Avg. time to resolve KPI is computed
- **THEN** it is the mean of `resolvedAt − createdAt` across tickets resolved in the period,
  expressed in days, and excludes tickets that never resolved

### Requirement: Reporting charts

The dashboard SHALL render four charts from in-memory-aggregated series: **Requests over time**
(a line of daily request counts across the period), **Status breakdown** (a donut over New /
Assigned / Waiting for student / Resolved / Closed with the total shown), **Requests by
category** (bars over the staff categories), and **Satisfaction trend** (a line of average
`rating` per week on a 1–5 scale). Charts SHALL be theme-aware (colors flip in light and dark).

#### Scenario: Status donut covers every status

- **WHEN** the Status breakdown donut renders
- **THEN** its segments sum to the total ticket count and cover all five lifecycle statuses

#### Scenario: Charts re-render for the selected filters

- **WHEN** the admin changes a filter
- **THEN** every chart re-aggregates to match the filtered dataset

#### Scenario: Charts render in both themes

- **WHEN** the dashboard is viewed in light and in dark
- **THEN** the charts use the theme's tokens and remain legible in both

### Requirement: Requests needing attention

The dashboard SHALL show a **Requests needing attention** table of the oldest still-open
requests (status New / Assigned / Waiting for student), ordered by age descending, each row
showing Request (title + category + code), Owner (or a dashed "Unassigned"), Status, and Age in
days (visually emphasised by staleness). Each row SHALL link into the triage board.

#### Scenario: Oldest open requests surface first

- **WHEN** the attention table renders
- **THEN** it lists only non-closed, non-resolved requests, oldest-by-age first

#### Scenario: Attention rows link to the staff surface

- **WHEN** an admin follows an attention row's link
- **THEN** they are taken to the triage board (or the request's staff detail)

### Requirement: Reporting filters

The dashboard SHALL offer filters — **date range** (Last 30 days / Last 7 days / This term /
Year to date), **category**, and **advisor** — applied in memory to the fetched dataset. Every
KPI, chart, and the attention table SHALL reflect the active filters, and the active filters
SHALL be shown to the admin.

#### Scenario: Category filter narrows every metric

- **WHEN** an admin selects a single category
- **THEN** the KPIs, charts, and attention table all recompute over only that category's tickets

#### Scenario: Date range drives the period

- **WHEN** an admin selects a date range
- **THEN** the KPI period and the chart windows use that range, and the trend compares to the
  preceding equal-length window

### Requirement: Export report

The dashboard SHALL provide an **Export report** action that downloads the current (filtered)
KPIs and needs-attention rows as a CSV file, generated client-side. The export SHALL reflect the
active filters at the time of export.

#### Scenario: Export produces a CSV of the current view

- **WHEN** an admin clicks Export report with filters applied
- **THEN** a CSV file downloads containing the filtered KPI values and attention-table rows
