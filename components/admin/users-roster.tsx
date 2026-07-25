"use client";

// /admin/users — People & access roster. Counts, tab filtering, search, and sorting are all
// computed in memory over the roster the RSC already read (single-field orderBy, no
// composite index), matching the staff triage board's pattern.
//
// Create and delete fire different server actions from one screen, so they call the actions
// directly via useTransition + router.refresh() rather than useActionState (the US-07 board
// pattern). Advisor/Staff tabs filter on the display-only `staffType`-derived uiRole, never
// on the claim — both are `advisor` (ADR-0007).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createUser, deleteUser, type AdminUserState } from "@/lib/actions/admin-users";
import {
  CREATABLE_UI_ROLES,
  type AdminUser,
  type UiRole,
  UI_ROLE_LABEL,
  UI_ROLE_ORDER,
  UI_ROLE_PILL,
  unitNoteOf,
  unitOf,
} from "@/lib/admin-users";
import { joinedDate } from "@/lib/format";
import {
  ChevronGlyph,
  DangerGlyph,
  PersonPlusGlyph,
  RoleGlyph,
  SortGlyph,
  TrashGlyph,
  type RoleIcon,
} from "./glyphs";
import { Modal } from "./modal";
import { emptyForm, UserFormFields, type UserFormValues } from "./user-form-fields";

const IDLE: AdminUserState = { status: "idle" };

type TabId = "all" | UiRole;
const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "student", label: "Students" },
  { id: "advisor", label: "Advisors" },
  { id: "staff", label: "Staff" },
  { id: "admin", label: "Admins" },
];

type SortKey = "name" | "role" | "unit" | "joined";
const HEADERS: { key: SortKey; label: string; hideNarrow?: boolean }[] = [
  { key: "name", label: "Person" },
  { key: "role", label: "Role" },
  { key: "unit", label: "Program / department", hideNarrow: true },
  { key: "joined", label: "Joined" },
];
const SORT_LABEL: Record<SortKey, string> = {
  name: "name",
  role: "role",
  unit: "program / department",
  joined: "joined",
};

const TILES: { id: UiRole; label: string; icon: RoleIcon; note: (u: AdminUser[]) => string }[] = [
  { id: "student", label: "Students", icon: "cap", note: () => "Portal access only" },
  {
    id: "advisor",
    label: "Advisors",
    icon: "compass",
    note: (u) => `${u.filter((x) => x.uiRole === "advisor" && x.bookable).length} bookable this term`,
  },
  { id: "staff", label: "Support staff", icon: "brief", note: () => "Across records, finance, IT" },
  { id: "admin", label: "Administrators", icon: "shield", note: () => "Full access to reports" },
];

function formData(values: Record<string, string | boolean | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((v) => fd.append(key, v));
    else fd.set(key, typeof value === "boolean" ? String(value) : value);
  }
  return fd;
}

export function UsersRoster({
  users,
  error,
  currentUid,
}: {
  users: AdminUser[];
  error: boolean;
  currentUid: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [tab, setTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<UserFormValues>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<AdminUserState>(IDLE);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<TabId, number> = { all: users.length, student: 0, advisor: 0, staff: 0, admin: 0 };
    for (const u of users) c[u.uiRole] += 1;
    return c;
  }, [users]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = tab === "all" ? users : users.filter((u) => u.uiRole === tab);
    if (q) {
      list = list.filter((u) =>
        `${u.displayName} ${u.email} ${unitOf(u)} ${unitNoteOf(u)} ${u.studentId}`
          .toLowerCase()
          .includes(q),
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "role") {
        const d = UI_ROLE_ORDER[a.uiRole] - UI_ROLE_ORDER[b.uiRole];
        return (d || a.displayName.localeCompare(b.displayName)) * dir;
      }
      if (sortKey === "unit") return unitOf(a).localeCompare(unitOf(b)) * dir;
      if (sortKey === "joined") return ((a.createdAtMs ?? 0) - (b.createdAtMs ?? 0)) * dir;
      return a.displayName.localeCompare(b.displayName) * dir;
    });
  }, [users, tab, search, sortKey, sortDir]);

  function sortBy(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function closeCreate() {
    setCreateOpen(false);
    setForm(emptyForm());
    setShowPassword(false);
    setResult(IDLE);
  }

  function submitCreate() {
    startTransition(async () => {
      const state = await createUser(
        IDLE,
        formData({
          uiRole: form.uiRole,
          displayName: form.displayName,
          email: form.email,
          password: form.password,
          program: form.program,
          cohort: form.cohort,
          studentId: form.studentId,
          dept: form.dept,
          title: form.title,
          cats: form.cats,
          bookable: form.bookable,
        }),
      );
      setResult(state);
      if (state.status === "success") {
        const name = form.displayName.trim();
        const role = UI_ROLE_LABEL[form.uiRole].toLowerCase();
        setTab(form.uiRole);
        closeCreate();
        setToast(`${name} created as ${role} — they can sign in with the password you set.`);
        router.refresh();
      }
    });
  }

  function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      const state = await deleteUser(IDLE, formData({ uid: target.id }));
      setDeleteTarget(null);
      if (state.status === "success") {
        setToast(`${target.displayName} deleted permanently.`);
        router.refresh();
      } else {
        setToast(
          state.status === "error"
            ? (state.message ?? "Couldn’t delete that account.")
            : "Couldn’t delete that account.",
        );
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-8 pb-[72px] pt-[22px] max-[560px]:px-4">
      {/* HEADER */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-ink">People &amp; access</h1>
          <p className="mt-1 text-[14px] text-body">
            {counts.all} accounts · {counts.student} students, {counts.advisor} advisors,{" "}
            {counts.staff} staff
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-[11px] bg-gold px-[18px] py-3 text-[14px] font-bold text-[#0d2c49] shadow-[0_4px_12px_rgba(215,165,36,0.28)] hover:bg-gold-hover"
        >
          <PersonPlusGlyph />
          Create user
        </button>
      </div>

      {toast ? (
        <div
          role="status"
          className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--ok)] bg-[var(--ok-bg)] p-[13px_16px]"
        >
          <span className="flex-1 text-[13.5px] font-semibold text-ink">{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="text-muted-2 hover:text-ink"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* SUMMARY TILES */}
      <div className="mb-[18px] grid grid-cols-4 gap-3.5 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
        {TILES.map((tile) => (
          <div
            key={tile.id}
            className="rounded-2xl border border-line bg-card p-[18px_20px] shadow-[0_1px_2px_var(--card-shadow)]"
          >
            <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-[9px] bg-teal-tint text-teal">
              <RoleGlyph icon={tile.icon} />
            </div>
            <div className="text-[24px] font-bold tabular-nums text-ink">{counts[tile.id]}</div>
            <div className="text-[13px] font-semibold text-ink">{tile.label}</div>
            <div className="mt-0.5 text-[12px] text-muted">{tile.note(users)}</div>
          </div>
        ))}
      </div>

      {/* TABS + SEARCH */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-0.5 rounded-[10px] border border-field bg-card p-1">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTab(t.id)}
                className={`rounded-[7px] px-3 py-[7px] text-[13px] font-semibold ${
                  on ? "bg-[var(--tile)] text-white" : "text-muted-2 hover:text-ink"
                }`}
              >
                {t.label}{" "}
                <span className="tabular-nums opacity-70">{counts[t.id]}</span>
              </button>
            );
          })}
        </div>
        <div className="relative flex min-w-[240px] flex-1 items-center justify-end gap-2">
          <label className="sr-only" htmlFor="admin-user-search">
            Search people
          </label>
          <input
            id="admin-user-search"
            type="search"
            autoComplete="off"
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or ID"
            className="field max-w-[320px]"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-[13px] font-semibold text-teal hover:text-ink"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_1px_2px_var(--card-shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="bg-[var(--head-bg)]">
                {HEADERS.map((h) => (
                  <th
                    key={h.key}
                    scope="col"
                    aria-sort={
                      sortKey === h.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                    }
                    className={`border-b border-line px-4 py-3 text-[12px] font-bold uppercase tracking-[0.4px] text-muted ${
                      h.hideNarrow ? "max-[940px]:hidden" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => sortBy(h.key)}
                      className="inline-flex items-center gap-1.5 uppercase hover:text-ink"
                    >
                      {h.label}
                      {sortKey === h.key ? <SortGlyph dir={sortDir} /> : null}
                    </button>
                  </th>
                ))}
                <th
                  scope="col"
                  className="border-b border-line px-4 py-3 text-right text-[12px] font-bold uppercase tracking-[0.4px] text-muted"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <p className="text-[15px] font-semibold text-ink">Couldn’t load the roster</p>
                    <p className="mt-1 text-[13px] text-body">
                      Something went wrong reading accounts — refresh to try again.
                    </p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <p className="text-[15px] font-semibold text-ink">No people match this view</p>
                    <p className="mt-1 text-[13px] text-body">
                      Clear the search or pick another role tab.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="border-b border-divider last:border-0 hover:bg-inset">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[var(--tile)] text-[13px] font-bold text-white"
                        >
                          {u.initials}
                        </span>
                        <span className="min-w-0">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="block truncate text-[14px] font-semibold text-ink hover:text-teal"
                          >
                            {u.displayName || "—"}
                          </Link>
                          <span className="block truncate text-[12.5px] text-muted">{u.email}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-md px-[11px] py-1 text-[12px] font-bold ${UI_ROLE_PILL[u.uiRole]}`}
                      >
                        {UI_ROLE_LABEL[u.uiRole]}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-[940px]:hidden">
                      <span className="block truncate text-[13.5px] text-ink">{unitOf(u) || "—"}</span>
                      <span className="block truncate text-[12.5px] text-muted">{unitNoteOf(u)}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[13px] tabular-nums text-body">
                      {joinedDate(u.createdAtMs)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/users/${u.id}`}
                          aria-label={`Open profile for ${u.displayName}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-2 hover:bg-inset hover:text-ink"
                        >
                          <ChevronGlyph dir="right" />
                        </Link>
                        <button
                          type="button"
                          disabled={u.id === currentUid || pending}
                          onClick={() => setDeleteTarget(u)}
                          aria-label={
                            u.id === currentUid ? "You cannot delete your own account" : `Delete ${u.displayName}`
                          }
                          title={u.id === currentUid ? "You cannot delete your own account" : undefined}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-2 hover:bg-[var(--err-bg)] hover:text-err disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted-2"
                        >
                          <TrashGlyph />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-[var(--head-bg)] px-4 py-2.5 text-[12.5px] text-muted">
          <span>
            Showing {rows.length} of {counts.all} accounts
          </span>
          <span>
            Sorted by {SORT_LABEL[sortKey]} · {sortDir === "asc" ? "ascending" : "descending"}
          </span>
        </div>
      </div>

      {/* CREATE MODAL */}
      {createOpen ? (
        <Modal labelledBy="create-user-heading" onClose={closeCreate}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitCreate();
            }}
          >
            <h2 id="create-user-heading" className="text-[19px] font-bold text-ink">
              Create user
            </h2>
            <p className="mb-5 mt-1 text-[13.5px] text-body">
              Set the role, identity and a starting password. You can edit everything later from
              their profile.
            </p>

            <UserFormFields
              values={form}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              fieldErrors={result.status === "error" ? result.fieldErrors : undefined}
              roleOptions={CREATABLE_UI_ROLES}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((s) => !s)}
              passwordLabel="Password"
              passwordPlaceholder="At least 8 characters"
              disabled={pending}
            />

            {result.status === "error" && result.message ? (
              <p role="alert" className="mt-4 text-[13px] font-semibold text-err">
                {result.message}
              </p>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeCreate}
                className="rounded-[10px] border border-field px-4 py-2.5 text-[13.5px] font-semibold text-ink hover:border-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-[10px] bg-gold px-[17px] py-[11px] text-[13.5px] font-bold text-[#0d2c49] hover:bg-gold-hover disabled:opacity-60"
              >
                <PersonPlusGlyph />
                {pending ? "Creating…" : "Create account"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* DELETE CONFIRM */}
      {deleteTarget ? (
        <Modal labelledBy="delete-user-heading" onClose={() => setDeleteTarget(null)} narrow>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--err-bg)] text-err">
            <DangerGlyph />
          </div>
          <h2 id="delete-user-heading" className="mb-2 text-[18px] font-bold text-ink">
            Delete {deleteTarget.displayName}?
          </h2>
          <p className="mb-5 text-[13.5px] leading-[1.6] text-body">
            This permanently removes the account and its sign-in credentials. Their past requests
            stay in the system, attributed to a removed user. This can’t be undone.
          </p>
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-[10px] border border-field px-4 py-2.5 text-[13.5px] font-semibold text-ink hover:border-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={confirmDelete}
              className="rounded-[10px] bg-err px-[17px] py-[11px] text-[13.5px] font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
