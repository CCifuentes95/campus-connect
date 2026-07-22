"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  createTicket,
  type CreateTicketState,
} from "@/lib/actions/tickets";
import { CATEGORY_OPTIONS, PRIORITY_VALUES, priorityStyle } from "@/lib/labels";

const INITIAL: CreateTicketState = { status: "idle" };

const STEPS = [
  {
    n: "1",
    title: "We receive your request",
    body: "It’s logged with a reference number and added to the support queue.",
  },
  {
    n: "2",
    title: "A specialist is assigned",
    body: "The right team member picks it up — usually within one business day.",
  },
  {
    n: "3",
    title: "We follow up with you",
    body: "You’ll get updates here and by email, and can reply anytime from the ticket.",
  },
] as const;

const MAX_DESC = 1000;

function AlertIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p
      id={id}
      className="mt-[7px] flex items-center gap-1.5 text-[12.5px] font-medium text-err"
    >
      <AlertIcon />
      {message}
    </p>
  );
}

function StepList() {
  return (
    <div className="flex flex-col gap-0.5">
      {STEPS.map((st, i) => (
        <div key={st.n} className="flex gap-3.5">
          <div className="flex flex-shrink-0 flex-col items-center">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-teal-tint text-[13px] font-bold text-teal">
              {st.n}
            </div>
            {i < STEPS.length - 1 ? (
              <div className="my-[3px] w-0.5 flex-1 bg-step-line" />
            ) : null}
          </div>
          <div className="pb-[18px]">
            <div className="text-[14px] font-semibold text-ink">{st.title}</div>
            <div className="mt-0.5 text-[13px] leading-[1.5] text-body">
              {st.body}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RequestForm() {
  const [state, formAction, isPending] = useActionState(createTicket, INITIAL);

  if (state.status === "success") {
    return <SuccessPanel code={state.code} />;
  }

  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <FormBody
      key={state.status}
      formAction={formAction}
      isPending={isPending}
      topAlert={state.status === "error" ? state.message : null}
      errors={errors}
      values={values}
    />
  );
}

function FormBody({
  formAction,
  isPending,
  topAlert,
  errors,
  values,
}: {
  formAction: (formData: FormData) => void;
  isPending: boolean;
  topAlert: string | null;
  errors: Partial<Record<"title" | "category" | "description", string>>;
  values?: {
    title: string;
    category: string;
    priority: string;
    description: string;
  };
}) {
  const [priority, setPriority] = useState(values?.priority ?? "medium");
  const [descLen, setDescLen] = useState(values?.description.length ?? 0);
  const alertRef = useRef<HTMLDivElement>(null);

  // Move focus to the error summary when validation fails (WIG focus management).
  useEffect(() => {
    if (topAlert) alertRef.current?.focus();
  }, [topAlert]);

  const overLimit = descLen > MAX_DESC;

  return (
    <div>
      <h1 className="mb-1.5 text-[28px] font-bold text-ink">New support request</h1>
      <p className="mb-[26px] max-w-[620px] text-[15px] leading-[1.6] text-body">
        Tell us what you need help with. The more detail you share, the faster the
        right person can assist you.
      </p>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* FORM CARD */}
        <form
          action={formAction}
          noValidate
          className="rounded-2xl border border-line bg-card p-7 px-[30px] shadow-[0_1px_2px_var(--card-shadow)]"
        >
          {topAlert ? (
            <div
              ref={alertRef}
              tabIndex={-1}
              role="alert"
              className="mb-6 flex items-start gap-[11px] rounded-[11px] border border-err bg-err-bg px-[15px] py-[13px] outline-none"
            >
              <span className="mt-px flex-shrink-0 text-err">
                <AlertIcon size={18} />
              </span>
              <div>
                <div className="text-[14px] font-semibold text-ink">{topAlert}</div>
                <div className="mt-0.5 text-[13px] text-body">
                  The highlighted fields below need your attention before we can
                  submit.
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-[22px]">
            {/* TITLE */}
            <div>
              <label
                htmlFor="title"
                className="mb-[7px] block text-[13.5px] font-semibold text-ink"
              >
                Title <span className="text-err">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                defaultValue={values?.title}
                placeholder="e.g. Registration hold on BCOM 301"
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "title-error" : undefined}
                className={`field ${errors.title ? "field-error" : ""}`}
              />
              {errors.title ? (
                <FieldError id="title-error" message={errors.title} />
              ) : null}
            </div>

            {/* CATEGORY + PRIORITY */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="category"
                  className="mb-[7px] block text-[13.5px] font-semibold text-ink"
                >
                  Category <span className="text-err">*</span>
                </label>
                <div className="relative">
                  <select
                    id="category"
                    name="category"
                    defaultValue={values?.category ?? ""}
                    aria-invalid={errors.category ? true : undefined}
                    aria-describedby={errors.category ? "category-error" : undefined}
                    className={`field appearance-none ${errors.category ? "field-error" : ""}`}
                  >
                    <option value="" disabled>
                      Select a category…
                    </option>
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="pointer-events-none absolute right-[13px] top-1/2 -translate-y-1/2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {errors.category ? (
                  <FieldError id="category-error" message={errors.category} />
                ) : null}
              </div>

              <div>
                <span className="mb-[7px] block text-[13.5px] font-semibold text-ink">
                  Priority
                </span>
                <input type="hidden" name="priority" value={priority} />
                <div className="flex gap-2" role="group" aria-label="Priority">
                  {PRIORITY_VALUES.map((p) => {
                    const style = priorityStyle(p);
                    const active = priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        aria-pressed={active}
                        className="flex-1 rounded-[9px] px-1.5 py-2.5 text-[13px]"
                        style={
                          active
                            ? {
                                fontWeight: 700,
                                background: style.tintVar,
                                color: style.colorVar,
                                border: `1.5px solid ${style.colorVar}`,
                              }
                            : {
                                fontWeight: 600,
                                background: "transparent",
                                color: "var(--muted-2)",
                                border: "1.5px solid var(--field)",
                              }
                        }
                      >
                        {style.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* DESCRIPTION */}
            <div>
              <label
                htmlFor="description"
                className="mb-[7px] block text-[13.5px] font-semibold text-ink"
              >
                Description <span className="text-err">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                defaultValue={values?.description}
                onChange={(e) => setDescLen(e.target.value.length)}
                placeholder="Describe what you need help with, including any course codes, dates, or reference numbers."
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={
                  errors.description ? "description-error" : "description-hint"
                }
                className={`field resize-y ${errors.description ? "field-error" : ""}`}
              />
              <div className="mt-[7px] flex items-center justify-between gap-3">
                {errors.description ? (
                  <FieldError id="description-error" message={errors.description} />
                ) : (
                  <span id="description-hint" className="text-[12px] text-muted">
                    Helps us route your request
                  </span>
                )}
                <span
                  className={`text-[12px] tabular-nums ${overLimit ? "font-semibold text-err" : "text-muted"}`}
                >
                  {descLen} / {MAX_DESC}
                </span>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="mt-0.5 flex items-center gap-3 border-t border-divider pt-[22px]">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-[9px] rounded-[11px] bg-gold px-6 py-[13px] text-[15px] font-bold text-navy shadow-[0_4px_12px_rgba(215,165,36,0.28)] hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                <svg
                  aria-hidden="true"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {isPending ? "Submitting…" : "Submit request"}
              </button>
              <Link
                href="/requests"
                className="rounded-[11px] px-5 py-[13px] text-[15px] font-semibold text-body hover:text-ink"
              >
                Cancel
              </Link>
            </div>
          </div>
        </form>

        {/* WHAT HAPPENS NEXT */}
        <aside className="rounded-2xl border border-line bg-card p-6 px-[26px] shadow-[0_1px_2px_var(--card-shadow)]">
          <div className="mb-3.5 text-[11px] font-bold uppercase tracking-[1.2px] text-gold-ink">
            What happens next
          </div>
          <StepList />
          <div className="mt-1 flex items-center gap-2.5 rounded-[11px] bg-teal-tint px-[15px] py-[13px]">
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--teal)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div className="text-[13px] font-medium text-ink">
              Typical first response: <strong>within 1 business day</strong>.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SuccessPanel({ code }: { code: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the confirmation heading so the outcome is announced (WIG).
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto mt-2 max-w-[640px]">
      <div className="rounded-[18px] border border-line bg-card px-10 py-11 text-center shadow-[0_1px_2px_var(--card-shadow)]">
        <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-teal-tint">
          <svg
            aria-hidden="true"
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--teal)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mb-[9px] text-[25px] font-bold text-ink outline-none"
        >
          Your request has been submitted
        </h1>
        <p className="mx-auto mb-[22px] max-w-[440px] text-[15px] leading-[1.6] text-body">
          Our support team has received your request and will be in touch soon.
        </p>
        <div className="mb-[26px] inline-flex items-center gap-2.5 rounded-[11px] border border-line bg-page px-[18px] py-[11px]">
          <span className="text-[13px] text-muted">Reference</span>
          <span className="font-mono text-[15px] font-bold text-ink" translate="no">
            #{code}
          </span>
        </div>

        <div className="mb-[26px] rounded-[14px] border border-line bg-page px-6 py-[22px] text-left">
          <div className="mb-4 text-[11px] font-bold uppercase tracking-[1.2px] text-gold-ink">
            What happens next
          </div>
          <StepList />
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {/* US-05 rewires this to /requests/[id] (Track Ticket). */}
          <Link
            href="/requests"
            className="rounded-[11px] bg-btn2 px-[22px] py-[13px] text-[15px] font-semibold text-btn2-text hover:bg-btn2-hover"
          >
            View request
          </Link>
          <Link
            href="/"
            className="rounded-[11px] px-5 py-[13px] text-[15px] font-semibold text-body hover:text-ink"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
