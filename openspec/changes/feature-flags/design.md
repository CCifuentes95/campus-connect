## Context

CampusConnect is an SSR Next.js app on Vercel with Firebase behind it. Reads happen in server
components via `FirebaseServerApp`; mutations are `"use server"` actions. There is no staging
environment and one Firebase project. We want a kill-switch / feature-gate lever per flow
without adding an external SaaS or a client-side flag SDK. This change adds the smallest thing
that works and fits the existing server-read grain.

## Goals / Non-Goals

**Goals:**
- A typed flag registry + `isEnabled(flag)` server-only helper with **safe-default-on**.
- A consistent gating contract: check at the route entry (RSC) and inside the flow's actions.
- No flag value ever reaches the client bundle; no per-request network fetch.

**Non-Goals:**
- Runtime toggling without redeploy (env-var change on Vercel implies a redeploy). A Firestore
  `config` doc source is a documented future swap, not built now.
- Per-user / percentage rollout / targeting (LaunchDarkly territory) — explicitly out.
- A flags admin UI.
- Client-side flags (would require `NEXT_PUBLIC_*`, inlining values and losing the kill-switch
  property). All gating is server-side.

## Decisions

### 1. Env-var backing with a typed registry

`lib/flags.ts` (server-only) exports a `FLAGS` registry mapping each flag name to its env-var
name, and `isEnabled(name: FlagName): boolean`. `FlagName` is a union derived from the
registry, so an off-registry name is a compile error. Values are read from `process.env`
(non-`NEXT_PUBLIC_*`), so they are available in RSC/action server execution and never inlined
into the client bundle.

- *Alternative:* a Firestore `config/flags` doc read via `FirebaseServerApp`. Rejected for
  now — adds a read per gated page + a rules entry for zero MVP benefit; the source is
  swappable behind `isEnabled` later if runtime toggling is ever needed.
- *Alternative:* `NEXT_PUBLIC_*` flags. Rejected — inlined at build into the client bundle,
  which both leaks the flag set and defeats a server-side kill switch.

### 2. Safe-default-on parsing

`isEnabled` returns `false` **only** for an explicit recognised falsey value (`off` / `false`
/ `0`, case-insensitive, trimmed); everything else — unset, empty, typo — returns `true`. This
guarantees that shipping the flag layer, or a misconfigured deploy, never silently disables a
live feature. Turning a flow off is a deliberate act.

- *Trade-off:* a typo like `FLAG=of` reads as on, not off. Acceptable — failing *open* on a
  kill-switch layer is the safer default for an MVP; documented in the ADR.

### 3. Two-layer gating (route + action)

Route gate makes the flow unreachable (a redirect from the layout/page, mirroring the existing
role-gate layouts); the action gate is defence-in-depth so a stale client form can't drive a
disabled flow. Both call the same `isEnabled`. The action gate returns the flow's existing
error result shape (discriminated `useActionState` result) so no new UI plumbing is needed.

- *Rationale:* rules are the real authorization boundary; flags are a product/ops lever, so
  they live in app code at both entry points rather than in `firestore.rules`.

### 4. Initial flag set defaults on → adoption is a no-op

`submit-request`, `book-appointment`, `notifications`, `staff-triage`. All default on, so
merging this change does not alter any flow's behavior until an operator sets a variable to
`off`. Each flow adds one `isEnabled` check at its route entry and one in its primary
action(s).

## Risks / Trade-offs

- **Fail-open semantics** → a misconfigured "off" reads as "on". Mitigated by documenting the
  recognised falsey values and defaulting deliberately (a kill switch should fail safe = on).
- **Redeploy to toggle** → env-var change needs a Vercel redeploy. Accepted for the MVP;
  the Firestore-source swap is noted for when runtime toggling is actually needed.
- **Gating drift** → a new flow forgetting its flag check. Mitigated by keeping the pattern
  tiny and documented in the ADR so it's cheap to copy.

## Migration Plan

1. Add `lib/flags.ts` + the ADR; document the env vars in `.env.example` / README.
2. Add the route + action checks to the initial flows (behavior unchanged — all default on).
3. To disable a flow later: set its variable to `off` in Vercel env and redeploy.
4. Rollback: remove the variable (or set anything non-falsey) → flow re-enables on next deploy.

## Open Questions

- None blocking. If runtime toggling becomes a real need, swap the `isEnabled` source to a
  cached Firestore `config` read behind the same signature — no call-site changes.
