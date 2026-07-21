// Shared role helpers — safe to import from client OR server (no server-only deps).
// The authoritative role lives in the Firebase custom claim; these are pure helpers.

export type Role = "student" | "advisor" | "admin";

export const ROLES: Role[] = ["student", "advisor", "admin"];

export function isRole(value: unknown): value is Role {
  return value === "student" || value === "advisor" || value === "admin";
}

// advisor + admin are one working tier (ADR-0001)
export function isStaff(role: Role | null | undefined): boolean {
  return role === "advisor" || role === "admin";
}

export function isAdmin(role: Role | null | undefined): boolean {
  return role === "admin";
}

// Where each role lands after sign-in / when redirected off a wrong-role route.
export function homeForRole(role: Role | null | undefined): string {
  if (role === "admin") return "/admin/reports";
  if (role === "advisor") return "/staff/triage";
  return "/";
}
