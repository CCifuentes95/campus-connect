## 1. Flag helper

- [ ] 1.1 Create `lib/flags.ts` (server-only): a `FLAGS` registry mapping each flag name to its
      env-var name, a `FlagName` union derived from it, and `isEnabled(name: FlagName): boolean`
      with safe-default-on parsing (off only for `off`/`false`/`0`, case-insensitive/trimmed).
- [ ] 1.2 Seed the initial registry: `submit-request`, `book-appointment`, `notifications`,
      `staff-triage` (env vars, e.g. `FLAG_SUBMIT_REQUEST` …). Non-`NEXT_PUBLIC_*`.
- [ ] 1.3 Add a tiny unit-style check (script or test) asserting unset→true, `off`→false,
      `garbage`→true, so the safe-default semantics don't regress.

## 2. Route + action gating on the initial flows

- [ ] 2.1 Submit-request: `isEnabled('submit-request')` gate at `/requests/new` (redirect/disabled
      state when off) + guard in `createTicket`.
- [ ] 2.2 Book-appointment: gate at `/appointments/new` + guard in `bookAppointment`.
- [ ] 2.3 Notifications: gate the `/notifications` route + guard the notification write path
      (`notifyStudent` no-ops or the calling actions skip when off — pick the least-surprising
      spot and document it).
- [ ] 2.4 Staff-triage: gate `/staff/triage` + `/staff/requests/[id]` + guard the staff ticket
      actions. (Coordinate with the staff-triage change once it lands.)

## 3. Docs

- [ ] 3.1 Document the flag env vars in `.env.example` / README (names + default-on note).
- [ ] 3.2 Write `docs/adr/` entry: config flags vs. LaunchDarkly (Context → Decision →
      Consequences → Alternatives), including the fail-open rationale and the Firestore-source
      future swap.

## 4. Verify

- [ ] 4.1 With all flags default (unset), confirm every flow behaves exactly as before.
- [ ] 4.2 Set one flag to `off`, rebuild, and confirm the route is unreachable AND the action
      refuses to write; grep the client bundle to confirm no flag value is inlined.
- [ ] 4.3 `pnpm lint` + `pnpm build` clean.
