# ADR-0001: Flat role model (advisor + admin are staff)

Status: Accepted

## Context

CampusConnect has three kinds of user: students who raise requests and book advising;
staff who work requests; and administrators who also need reporting and the ability to
grant roles. A natural instinct is a richer permission matrix (separate "advisor",
"support agent", "supervisor", "admin" tiers, each with distinct capabilities on tickets).

For an academic-exercise MVP on Firestore, every extra tier means more branches in
`firestore.rules` and more claim values to manage, for capability distinctions the
product does not yet need.

## Decision

Use a **flat, three-value role** stored as a Firebase Auth custom claim:
`student | advisor | admin`.

- `advisor` and `admin` form **one working tier** for ticket work. An advisor is simply a
  staff member who *also* owns advising appointments. Any staff member can triage, claim,
  reassign, and unassign any ticket.
- `admin` is a **strict superset**: everything staff can do, plus reporting and role
  management (the `setRole` callable).
- Rules express this with `isStaff()` = `role in ["advisor","admin"]` and
  `isAdmin()` = `role == "admin"`. No per-capability claims.

## Consequences

- Rules stay small and read-free — authorization is a token claim check, no document lookup.
- No fine-grained "this advisor owns only their department's tickets" — any staff sees any
  ticket. Acceptable for the MVP; revisit if departments need isolation.
- Promoting/demoting is a single claim write via an admin-only callable; effect lands on the
  next token refresh (`getIdToken(true)`).

## Alternatives considered

- **Per-capability claims / RBAC matrix** — more expressive, but premature; adds rules
  complexity with no current requirement.
- **Role stored in a Firestore `users` doc** — would force a document read inside rules on
  every request (cost + latency) and risks the claim/doc drifting. Rejected; the doc keeps
  only a display mirror of the role.
