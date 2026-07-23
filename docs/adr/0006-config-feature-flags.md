# ADR-0006: Lightweight config feature flags over LaunchDarkly

Status: Accepted

## Context

We want a per-flow on/off lever — to hide a half-finished flow, run a reduced-surface demo, or
kill-switch a flow that misbehaves in production — without ripping out code. CampusConnect is an
SSR Next.js app on Vercel with Firebase behind it: reads happen in server components via
`FirebaseServerApp`, mutations are `"use server"` actions, `/login` is statically prerendered,
and there is a single Firebase project with no staging environment (see the stack notes and
ADR-0004). Whatever we add has to fit that grain and not undo the static-prerender / RSC model.

An external flag SaaS (LaunchDarkly and similar) brings a client-side SDK, an account, and
network-fetched flags. For a single-project academic MVP that is heavyweight, adds a runtime
dependency and a secret, and a client-side SDK collides with the static-prerender property. We
want ~90% of the value with none of that.

## Decision

- **A typed, server-only flag registry** in `lib/flags.ts`: `FLAGS` maps each stable flag name to
  a backing environment variable, `FlagName` is the derived union (an off-registry name is a
  compile error), and `isEnabled(name)` reads `process.env`. The module imports `server-only`,
  and the vars are **not** `NEXT_PUBLIC_*`, so no flag value is read on, or inlined into, the
  client bundle.
- **Safe-default-ON.** A flag is off **only** for a recognised falsey value (`off` / `false` /
  `0` / `no`, case-insensitive, trimmed). Unset, empty, or malformed reads as ON. Shipping the
  flag layer, or a misconfigured deploy, never silently disables a live feature — turning a flow
  off is a deliberate act.
- **Two-layer gating.** A flagged flow checks its flag at the **route** entry (the server
  component renders `<FeatureUnavailable/>` instead of the flow when off) and inside its
  **server action(s)** (return an error, no write) — defence-in-depth so a stale client form
  can't drive a disabled flow. Both call the same `isEnabled`.
- **Initial flags, all default ON:** `submit-request`, `book-appointment`, `notifications`,
  `staff-triage`. Adopting the layer is a no-op until an operator sets a var. For
  `notifications`, `notifyStudent` also no-ops when off so no orphan notifications accrue.
- **Toggling is an env-var change + redeploy** on Vercel. Runtime toggling without a redeploy is
  out of scope for now.

## Consequences

- A cheap, dependency-free kill switch that fits the existing server-read patterns; flag state
  never reaches the browser.
- Fail-open semantics: a typo like `FLAG_X=of` reads as ON. That is the safer default for a
  kill-switch layer (a misconfigured flag should not black out a shipped feature); the recognised
  falsey values are documented in `.env.example` and `lib/flags.ts`.
- Toggling needs a redeploy (no live flip). Acceptable for the MVP.
- If runtime toggling ever becomes a real need, swap the source inside `isEnabled` for a cached
  Firestore `config` read — no call-site changes, since every gate goes through `isEnabled`.
- A tiny regression guard (`scripts/check-flags.mjs`) pins the safe-default-on semantics (there is
  no test runner in the repo).

## Alternatives considered

- **LaunchDarkly / external flag SaaS.** Rejected: external account + client SDK, network-fetched
  flags that collide with static prerender, a new runtime dependency and secret — far too heavy
  for a single-project academic MVP.
- **A Firestore `config/flags` doc read via `FirebaseServerApp`.** Gives live runtime toggling but
  adds a read per gated page and a rules entry for zero MVP benefit. Deferred — it is the
  documented future swap behind `isEnabled` if the need appears.
- **`NEXT_PUBLIC_*` flags.** Rejected: inlined into the client bundle at build, which both leaks
  the flag set and defeats a server-side kill switch.
