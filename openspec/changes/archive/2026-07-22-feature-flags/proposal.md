## Why

As CampusConnect grows story by story, we want to turn whole flows on or off without ripping
out code — to hide a half-finished flow, run a demo with a reduced surface, or kill-switch a
flow that misbehaves in production. The MVP has no such lever today. LaunchDarkly and similar
SaaS are overkill for a single-Firebase-project academic MVP and collide with the static-
prerender / RSC model; a lightweight config-flag layer gives ~90% of the value with none of
the infrastructure and fits the existing server-read patterns.

## What Changes

- **A typed flag registry + server-only helper** (`lib/flags.ts`): a fixed set of named flags,
  each backed by an environment variable with a **safe default of `on`** (absent config never
  disables a shipped feature). `isEnabled(flag)` is callable from server components and server
  actions; there is no client-side flag SDK and no per-request network fetch.
- **Route-level gating**: a flagged route's layout/page redirects (or renders a "coming soon"
  state) when its flag is off, so the flow is unreachable end-to-end.
- **Action-level gating**: a flagged server action returns an error and performs no write when
  its flag is off, so a disabled flow can't be driven via a stale form/RPC.
- **Initial flag set** covering the major flows so they can be individually toggled:
  submit-request, book-appointment, notifications, staff-triage. Flags default on, so enabling
  the layer is a no-op until an operator sets a variable to `off`.
- **No UI, no new collection, no rules change** in this iteration — flags are read from
  server-side env (not `NEXT_PUBLIC_*`, so they are never inlined into the client bundle).

## Capabilities

### New Capabilities
- `feature-flags`: the flag registry, the server-only `isEnabled` helper with safe-default
  semantics, and the route/action gating contract that flows use to check a flag.

### Modified Capabilities
<!-- None. Existing flows adopt gating additively (a flag check at their entry points); this
     does not change their spec-level behavior when the flag is on, which is the default. -->

## Impact

- **New:** `lib/flags.ts` (registry + `isEnabled`), env vars (documented in `.env.example` /
  README), a short ADR (config flags vs. LaunchDarkly).
- **Touched (additive):** entry points of the flows in the initial set add a flag check —
  route layout/page redirect + server-action guard. Behavior is unchanged while a flag is on.
- **No secrets:** flag env vars are non-sensitive booleans; they are server-side only.
- **Deploy:** setting a flag is a Vercel env-var change (+ redeploy). Runtime toggling without
  redeploy is explicitly out of scope for this iteration (see design Non-Goals).
