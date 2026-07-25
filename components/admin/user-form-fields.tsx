"use client";

// The account form shared by the create modal and the user detail screen — identical
// fields in both, per the mockups ("Same fields as account creation").
//
// Advisor and Staff are separate role cards but the SAME `advisor` claim; the difference is
// carried by `staffType` and shown through `title`/`dept` (ADR-0007).

import { useEffect, useRef } from "react";
import {
  CATEGORIES,
  COHORTS,
  DEPARTMENTS,
  defaultsForRole,
  generatePassword,
  PROGRAMS,
  permissionNote,
  ROLE_CARDS,
  staffSectionLabel,
  titlePlaceholder,
  type UiRole,
} from "@/lib/admin-users";
import { CheckGlyph, ChevronGlyph, EyeGlyph, RefreshGlyph, RoleGlyph, WarnGlyph } from "./glyphs";

export interface UserFormValues {
  uiRole: UiRole;
  displayName: string;
  email: string;
  password: string;
  program: string;
  cohort: string;
  studentId: string;
  dept: string;
  title: string;
  cats: string[];
  bookable: boolean;
}

export function emptyForm(): UserFormValues {
  const d = defaultsForRole("student");
  return {
    uiRole: "student",
    displayName: "",
    email: "",
    password: "",
    program: d.program ?? "",
    cohort: d.cohort ?? "",
    studentId: "",
    dept: "Advising",
    title: "",
    cats: ["Advising"],
    bookable: true,
  };
}

type FieldErrors = Record<string, string[]> | undefined;

function firstError(errors: FieldErrors, key: string): string | null {
  return errors?.[key]?.[0] ?? null;
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mt-[5px] text-[12px] font-semibold text-err">{message}</p>;
}

const LABEL = "mb-1.5 block text-[13px] font-semibold text-ink";
const SECTION_LABEL =
  "mb-3.5 text-[12px] font-bold uppercase tracking-[0.5px] text-muted";

export function UserFormFields({
  values,
  onChange,
  fieldErrors,
  roleOptions,
  showPassword,
  onTogglePassword,
  passwordLabel,
  passwordPlaceholder,
  roleWarning,
  disabled,
}: {
  values: UserFormValues;
  onChange: (patch: Partial<UserFormValues>) => void;
  fieldErrors: FieldErrors;
  /** Create offers Student/Advisor/Staff; the detail screen also offers Admin. */
  roleOptions: readonly UiRole[];
  showPassword: boolean;
  onTogglePassword: () => void;
  passwordLabel: string;
  passwordPlaceholder: string;
  /** Rendered under the role cards when the role differs from the saved one. */
  roleWarning?: string | null;
  disabled?: boolean;
}) {
  const isStudent = values.uiRole === "student";
  const isAdvisor = values.uiRole === "advisor";
  const cards = ROLE_CARDS.filter((c) => roleOptions.includes(c.value));

  function selectRole(next: UiRole) {
    // Mirrors the mockup: switching role fills that branch's defaults without clobbering
    // anything the admin has already typed.
    const d = defaultsForRole(next);
    onChange({
      uiRole: next,
      ...(d.program && !values.program ? { program: d.program } : {}),
      ...(d.cohort && !values.cohort ? { cohort: d.cohort } : {}),
      ...(d.dept && !values.dept ? { dept: d.dept } : {}),
      ...(d.cats && values.cats.length === 0 ? { cats: d.cats } : {}),
    });
  }

  function toggleCat(cat: string) {
    onChange({
      cats: values.cats.includes(cat)
        ? values.cats.filter((c) => c !== cat)
        : [...values.cats, cat],
    });
  }

  const nameError = firstError(fieldErrors, "displayName");
  const emailError = firstError(fieldErrors, "email");
  const pwError = firstError(fieldErrors, "password");

  // Move focus to the first invalid field after a failed submit, so a keyboard or screen
  // reader user lands on the problem instead of hunting for red text.
  // `disabled` is in the deps deliberately: while the submit is in flight every field is
  // disabled, and focus() on a disabled element is a no-op — so the first attempt silently
  // does nothing and we have to retry once the fields come back.
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (disabled || !fieldErrors || Object.keys(fieldErrors).length === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [fieldErrors, disabled]);

  return (
    <div ref={formRef} className="flex flex-col gap-5">
      {/* ROLE */}
      <div>
        <span className="mb-[9px] block text-[12px] font-bold uppercase tracking-[0.5px] text-muted">
          Role
        </span>
        <div
          role="radiogroup"
          aria-label="Role"
          className={`grid gap-2.5 ${cards.length > 3 ? "grid-cols-4 max-[720px]:grid-cols-2" : "grid-cols-3 max-[560px]:grid-cols-1"}`}
        >
          {cards.map((card) => {
            const on = values.uiRole === card.value;
            return (
              <button
                key={card.value}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => selectRole(card.value)}
                className={`flex flex-col items-start gap-[7px] rounded-xl p-[13px_14px] text-left text-ink disabled:opacity-60 ${
                  on
                    ? "border-[1.5px] border-gold bg-[var(--pri-med-bg)]"
                    : "border border-field bg-card"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={on ? "text-gold-ink" : "text-muted"}>
                    <RoleGlyph icon={card.icon} />
                  </span>
                  <span className="text-[14px] font-bold">{card.label}</span>
                </span>
                <span className="text-left text-[11.5px] font-medium leading-[1.4] text-muted">
                  {card.blurb}
                </span>
              </button>
            );
          })}
        </div>
        {roleWarning ? (
          <div className="mt-[11px] flex items-start gap-[9px] rounded-[10px] bg-warn-bg p-[11px_13px]">
            <span className="mt-px text-warn">
              <WarnGlyph />
            </span>
            <span className="text-[12.5px] leading-[1.5] text-ink">{roleWarning}</span>
          </div>
        ) : null}
      </div>

      {/* IDENTITY */}
      <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
        <div>
          <label className={LABEL} htmlFor="admin-user-name">
            Full name
          </label>
          <input
            id="admin-user-name"
            name="displayName"
            value={values.displayName}
            onChange={(e) => onChange({ displayName: e.target.value })}
            placeholder="e.g. Amara Okafor"
            disabled={disabled}
            autoComplete="off"
            aria-invalid={nameError ? true : undefined}
            className={`field ${nameError ? "field-error" : ""}`}
          />
          <FieldError message={nameError} />
        </div>
        <div>
          <label className={LABEL} htmlFor="admin-user-email">
            University email
          </label>
          <input
            id="admin-user-email"
            name="email"
            type="email"
            value={values.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="name@ibu.edu"
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={emailError ? true : undefined}
            className={`field ${emailError ? "field-error" : ""}`}
          />
          <FieldError message={emailError} />
        </div>
      </div>

      {/* PASSWORD */}
      <div>
        <label className={LABEL} htmlFor="admin-user-password">
          {passwordLabel}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex min-w-[200px] flex-1 items-center">
            <input
              id="admin-user-password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={values.password}
              onChange={(e) => onChange({ password: e.target.value })}
              placeholder={passwordPlaceholder}
              disabled={disabled}
              // This is a password the admin is setting FOR SOMEONE ELSE. Without this the
              // browser offers to save it as the admin's own credential — and after creating
              // several accounts, to overwrite it.
              autoComplete="new-password"
              spellCheck={false}
              aria-invalid={pwError ? true : undefined}
              className={`field pr-[42px] ${pwError ? "field-error" : ""}`}
            />
            <button
              type="button"
              onClick={onTogglePassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-[7px] text-muted hover:text-ink"
            >
              <EyeGlyph off={showPassword} />
            </button>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange({ password: generatePassword() });
              if (!showPassword) onTogglePassword();
            }}
            className="inline-flex items-center gap-[7px] rounded-[10px] border border-field px-3.5 py-[11px] text-[13px] font-semibold text-ink hover:border-muted"
          >
            <RefreshGlyph />
            Generate
          </button>
        </div>
        {pwError ? (
          <FieldError message={pwError} />
        ) : (
          <p className="mt-[5px] text-[12.5px] text-muted">
            Share it with the person directly — they can change it after signing in.
          </p>
        )}
      </div>

      {/* STUDENT RECORD */}
      {isStudent ? (
        <div className="rounded-[13px] border border-line bg-page p-[18px_18px_20px]">
          <div className={SECTION_LABEL}>Student record</div>
          <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
            <div>
              <label className={LABEL} htmlFor="admin-user-studentid">
                Student ID
              </label>
              <input
                id="admin-user-studentid"
                name="studentId"
                value={values.studentId}
                onChange={(e) => onChange({ studentId: e.target.value })}
                placeholder="Auto-generated if blank"
                disabled={disabled}
                autoComplete="off"
                className="field"
              />
            </div>
            <SelectField
              id="admin-user-program"
              name="program"
              label="Programme"
              value={values.program}
              options={PROGRAMS}
              disabled={disabled}
              onChange={(v) => onChange({ program: v })}
            />
            <SelectField
              id="admin-user-cohort"
              name="cohort"
              label="Cohort"
              value={values.cohort}
              options={COHORTS}
              disabled={disabled}
              onChange={(v) => onChange({ cohort: v })}
            />
          </div>
        </div>
      ) : (
        /* ADVISOR / STAFF / ADMIN PROFILE */
        <div className="rounded-[13px] border border-line bg-page p-[18px_18px_20px]">
          <div className={SECTION_LABEL}>{staffSectionLabel(values.uiRole)}</div>
          <div className="mb-4 grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
            <SelectField
              id="admin-user-dept"
              name="dept"
              label="Department"
              value={values.dept}
              options={DEPARTMENTS}
              disabled={disabled}
              onChange={(v) => onChange({ dept: v })}
            />
            <div>
              <label className={LABEL} htmlFor="admin-user-title">
                Job title
              </label>
              <input
                id="admin-user-title"
                name="title"
                value={values.title}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder={titlePlaceholder(values.uiRole)}
                disabled={disabled}
                autoComplete="off"
                className="field"
              />
            </div>
          </div>

          <fieldset>
            <legend className="text-[13px] font-semibold text-ink">
              Request categories they handle
            </legend>
            <p className="mb-2.5 mt-1 text-[12.5px] text-muted">
              Recorded on their profile for reference.
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const on = values.cats.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={disabled}
                    onClick={() => toggleCat(cat)}
                    className={`inline-flex items-center gap-[7px] rounded-[20px] px-[13px] py-2 text-[13px] font-semibold ${
                      on
                        ? "border border-teal bg-teal-tint text-teal"
                        : "border border-field bg-card text-muted-2"
                    }`}
                  >
                    {on ? (
                      <CheckGlyph />
                    ) : (
                      <span className="inline-block h-[13px] w-[13px] shrink-0 rounded-[4px] border-[1.5px] border-field" />
                    )}
                    {cat}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {isAdvisor ? (
            <div className="mt-4 flex items-center gap-3 border-t border-divider pt-4">
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-ink">
                  Bookable for advising appointments
                </div>
                <div className="mt-0.5 text-[12.5px] text-muted">
                  Recorded on their profile — advising availability still comes from the
                  advising config.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={values.bookable}
                aria-label="Bookable for advising appointments"
                disabled={disabled}
                onClick={() => onChange({ bookable: !values.bookable })}
                className={`flex h-[26px] w-[46px] shrink-0 items-center rounded-[20px] p-[3px] ${
                  values.bookable ? "justify-end bg-gold" : "justify-start bg-[var(--field)]"
                }`}
              >
                <span className="block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(13,44,73,0.3)]" />
              </button>
            </div>
          ) : null}
        </div>
      )}

      <p className="text-[12.5px] text-muted">{permissionNote(values.uiRole)}</p>
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className={LABEL} htmlFor={id}>
        {label}
      </label>
      <div className="relative flex items-center">
        <select
          id={id}
          name={name}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="field appearance-none pr-8"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-[11px] text-muted">
          <ChevronGlyph />
        </span>
      </div>
    </div>
  );
}
