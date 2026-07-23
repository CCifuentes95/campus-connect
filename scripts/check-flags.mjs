// Regression guard for the feature-flag safe-default-on semantics (lib/flags.ts). No test
// runner is configured, so this is a tiny standalone assertion script. It mirrors the FALSEY
// set in lib/flags.ts — keep the two in sync. Run: `node scripts/check-flags.mjs`.
import assert from "node:assert/strict";

const FALSEY = new Set(["off", "false", "0", "no"]);
function flagEnabled(raw) {
  if (raw == null) return true;
  return !FALSEY.has(raw.trim().toLowerCase());
}

// unset / empty / malformed → ON (safe default)
assert.equal(flagEnabled(undefined), true, "unset must be enabled");
assert.equal(flagEnabled(null), true, "null must be enabled");
assert.equal(flagEnabled(""), true, "empty must be enabled");
assert.equal(flagEnabled("garbage"), true, "unrecognised value must be enabled");
assert.equal(flagEnabled("of"), true, "typo must fail open (enabled)");
assert.equal(flagEnabled("ON"), true, "'ON' must be enabled");

// explicit recognised falsey (case-insensitive, trimmed) → OFF
assert.equal(flagEnabled("off"), false, "'off' must be disabled");
assert.equal(flagEnabled("OFF"), false, "'OFF' must be disabled");
assert.equal(flagEnabled(" false "), false, "' false ' must be disabled");
assert.equal(flagEnabled("0"), false, "'0' must be disabled");
assert.equal(flagEnabled("no"), false, "'no' must be disabled");

console.log("✓ feature-flag semantics OK (safe-default-on)");
