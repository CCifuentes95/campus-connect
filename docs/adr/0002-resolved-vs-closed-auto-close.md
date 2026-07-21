# ADR-0002: Separate `resolved` and `closed`, with auto-close

Status: Accepted

## Context

When staff finish a support request, the student may still disagree it's done. A single
terminal "done" state forces a choice: either the student can never reopen (frustrating),
or "done" tickets reopen forever and never leave the queue (noisy metrics). We also want a
clean audit trail of *how* each ticket ended.

## Decision

Model two distinct end states in the ticket workflow
(`new → assigned → waiting_for_student → resolved → closed`):

- **`resolved`** = staff-done, pending student confirmation. **Reopenable**: `resolved →
  assigned` when the student (or staff) reopens.
- **`closed`** = terminal. Reached by an explicit **Close** action (`resolved → closed`,
  and `assigned → closed` for staff), or automatically.
- **Auto-close**: a scheduled Cloud Function moves `resolved → closed` after **N days**
  with no student reply, so satisfied-and-silent tickets don't linger.

Status is never written directly — each transition is a named server action that captures
its required input and appends an `events` audit doc recording `fromStatus`/`toStatus`,
actor, and role.

## Consequences

- Students get a real window to reopen; staff aren't blocked from moving on.
- "Open work" metrics exclude `resolved`, so queues reflect reality.
- Requires one scheduled function and a `resolvedAt` timestamp on each ticket to drive the
  N-day timer. N is a single configurable constant for the MVP.
- Reopen is bounded: only `resolved` reopens; `closed` is terminal (a new request is filed
  instead).

## Alternatives considered

- **Single terminal state** — simpler, but either denies reopen or pollutes metrics. Rejected.
- **Client-driven close** — unreliable (depends on the student acting) and unauditable.
  The scheduled function makes closure deterministic and logged.
