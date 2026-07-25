"use client";

// /admin/users/[id] — the edit half of the detail screen. Same fields as creation, plus a
// role-change warning and Discard/Save. Unlike the create modal this DOES offer Admin as a
// role: a new admin is made by promoting an existing account (the create form has no Admin
// card, matching the mockup) — see the role-access delta and ADR-0007.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteUser, updateUser, type AdminUserState } from "@/lib/actions/admin-users";
import {
  type AdminUser,
  UI_ROLES,
  UI_ROLE_LABEL,
  UI_ROLE_PILL,
} from "@/lib/admin-users";
import { DangerGlyph, SaveGlyph, TrashGlyph } from "./glyphs";
import { Modal } from "./modal";
import { UserFormFields, type UserFormValues } from "./user-form-fields";

const IDLE: AdminUserState = { status: "idle" };

function toForm(u: AdminUser): UserFormValues {
  return {
    uiRole: u.uiRole,
    displayName: u.displayName,
    email: u.email,
    password: "",
    program: u.program,
    cohort: u.cohort,
    studentId: u.studentId,
    dept: u.dept,
    title: u.title,
    cats: u.cats,
    bookable: u.bookable,
  };
}

function formData(values: Record<string, string | boolean | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((v) => fd.append(key, v));
    else fd.set(key, typeof value === "boolean" ? String(value) : value);
  }
  return fd;
}

export function UserDetailForm({
  user,
  isSelf,
}: {
  user: AdminUser;
  /** An admin can't delete their own account — the function rejects it too. */
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [saved, setSaved] = useState<AdminUser>(user);
  const [form, setForm] = useState<UserFormValues>(() => toForm(user));
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<AdminUserState>(IDLE);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const roleChanged = form.uiRole !== saved.uiRole;
  const dirty =
    roleChanged ||
    form.displayName !== saved.displayName ||
    form.email !== saved.email ||
    form.program !== saved.program ||
    form.cohort !== saved.cohort ||
    form.studentId !== saved.studentId ||
    form.dept !== saved.dept ||
    form.title !== saved.title ||
    form.bookable !== saved.bookable ||
    form.cats.join("|") !== saved.cats.join("|") ||
    form.password.length > 0;

  const roleWarning = roleChanged
    ? `Saving changes this account from ${UI_ROLE_LABEL[saved.uiRole].toLowerCase()} to ` +
      `${UI_ROLE_LABEL[form.uiRole].toLowerCase()} — ${
        form.uiRole === "student"
          ? "their department and queue assignments are cleared"
          : "their student record fields are cleared"
      }. Their access changes on their next sign-in or token refresh.`
    : null;

  function save() {
    startTransition(async () => {
      const state = await updateUser(
        IDLE,
        formData({
          uid: saved.id,
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
        const moved = roleChanged;
        const nextRole = form.uiRole;
        setSaved((s) => ({
          ...s,
          uiRole: nextRole,
          displayName: form.displayName.trim(),
          email: form.email.trim().toLowerCase(),
          program: nextRole === "student" ? form.program : "",
          cohort: nextRole === "student" ? form.cohort : "",
          studentId: nextRole === "student" ? form.studentId : "",
          dept: nextRole === "student" ? "" : form.dept,
          title: nextRole === "student" ? "" : form.title,
          cats: nextRole === "student" ? [] : form.cats,
          bookable: nextRole === "advisor" ? form.bookable : false,
        }));
        setForm((f) => ({ ...f, password: "" }));
        setToast(
          moved
            ? `Saved — ${form.displayName.trim()} is now ${UI_ROLE_LABEL[nextRole].toLowerCase()}.`
            : `Changes saved${form.password ? " — password updated" : ""}.`,
        );
        router.refresh();
      }
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const state = await deleteUser(IDLE, formData({ uid: saved.id }));
      setDeleteOpen(false);
      if (state.status === "success") router.push("/admin/users");
      else setResult(state);
    });
  }

  return (
    <>
      {/* PERSON HEADER */}
      <div className="mb-5 flex flex-wrap items-center gap-[18px]">
        <span
          aria-hidden
          className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full bg-[var(--tile)] text-[21px] font-bold text-white"
        >
          {saved.initials}
        </span>
        <div className="min-w-[220px] flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[26px] font-bold text-ink">{saved.displayName || "—"}</h1>
            <span
              className={`inline-flex items-center rounded-md px-[11px] py-1 text-[12px] font-bold ${UI_ROLE_PILL[saved.uiRole]}`}
            >
              {UI_ROLE_LABEL[saved.uiRole]}
            </span>
          </div>
          <p className="text-[14px] text-body">
            {[saved.email, saved.uiRole === "student" ? saved.program : saved.title]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={isSelf || pending}
            onClick={() => setDeleteOpen(true)}
            title={isSelf ? "You cannot delete your own account" : undefined}
            className="inline-flex items-center gap-2 rounded-[11px] border border-field px-4 py-[11px] text-[13.5px] font-semibold text-err hover:border-err hover:bg-[var(--err-bg)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-field disabled:hover:bg-transparent"
          >
            <TrashGlyph />
            Delete user
          </button>
          <button
            type="button"
            disabled={!dirty || pending}
            onClick={save}
            className={`inline-flex items-center gap-2 rounded-[11px] px-[18px] py-3 text-[14px] font-bold ${
              dirty
                ? "bg-gold text-[#0d2c49] shadow-[0_4px_12px_rgba(215,165,36,0.28)] hover:bg-gold-hover"
                : "bg-pill-bg text-muted-2"
            }`}
          >
            <SaveGlyph />
            {pending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>

      {toast ? (
        <div
          role="status"
          className="mb-[18px] flex items-center gap-3 rounded-xl border border-[var(--ok)] bg-[var(--ok-bg)] p-[13px_16px]"
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

      <div className="rounded-2xl border border-line bg-card shadow-[0_1px_2px_var(--card-shadow)]">
        <div className="border-b border-line p-[20px_24px_16px]">
          <h2 className="text-[16px] font-bold text-ink">Account details</h2>
          <p className="mt-0.5 text-[13px] text-body">
            Same fields as account creation — edit anything, including the role.
          </p>
        </div>
        <div className="p-[20px_24px_24px]">
          <UserFormFields
            values={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            fieldErrors={result.status === "error" ? result.fieldErrors : undefined}
            roleOptions={UI_ROLES}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((s) => !s)}
            passwordLabel="Set a new password"
            passwordPlaceholder="Leave blank to keep current password"
            roleWarning={roleWarning}
            disabled={pending}
          />

          {result.status === "error" && result.message ? (
            <p role="alert" className="mt-4 text-[13px] font-semibold text-err">
              {result.message}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              disabled={!dirty || pending}
              onClick={() => {
                setForm(toForm(saved));
                setResult(IDLE);
              }}
              className="rounded-[11px] border border-field px-[17px] py-[11px] text-[13.5px] font-semibold text-ink hover:border-muted disabled:opacity-40"
            >
              Discard changes
            </button>
            <button
              type="button"
              disabled={!dirty || pending}
              onClick={save}
              className={`rounded-[11px] px-[18px] py-3 text-[14px] font-bold ${
                dirty ? "bg-gold text-[#0d2c49] hover:bg-gold-hover" : "bg-pill-bg text-muted-2"
              }`}
            >
              {pending ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </div>
      </div>

      {deleteOpen ? (
        <Modal labelledBy="delete-user-heading" onClose={() => setDeleteOpen(false)} narrow>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--err-bg)] text-err">
            <DangerGlyph />
          </div>
          <h2 id="delete-user-heading" className="mb-2 text-[18px] font-bold text-ink">
            Delete {saved.displayName}?
          </h2>
          <p className="mb-5 text-[13.5px] leading-[1.6] text-body">
            This permanently removes the account and its sign-in credentials. Their past
            requests stay in the system, attributed to a removed user. This can’t be undone.
          </p>
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
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
    </>
  );
}
