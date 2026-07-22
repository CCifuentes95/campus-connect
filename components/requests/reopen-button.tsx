"use client";

import { useActionState } from "react";
import { reopenTicket, type ReopenState } from "@/lib/actions/tickets";

const INITIAL: ReopenState = { status: "idle" };

/**
 * Reopen a resolved/closed ticket (US-05): `resolved`/`closed → assigned`, a plain field update
 * with no audit event. Used twice on the detail page — in the resolved/closed banner (`ghost`)
 * and in the comment-area placeholder (`solid`). Both render the same server action.
 */
export function ReopenButton({
  ticketId,
  variant = "ghost",
  label = "Reopen request",
}: {
  ticketId: string;
  variant?: "ghost" | "solid";
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(reopenTicket, INITIAL);

  const cls =
    variant === "solid"
      ? "bg-[color:var(--btn2)] text-[color:var(--btn2-text)] hover:bg-[color:var(--btn2-hover)]"
      : "border border-line bg-card text-ink hover:border-[color:var(--card-hover-border)]";

  return (
    <form action={formAction} className="flex-shrink-0">
      <input type="hidden" name="ticketId" value={ticketId} />
      <button
        type="submit"
        disabled={pending}
        className={`whitespace-nowrap rounded-[9px] px-4 py-[10px] text-[13.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${cls}`}
      >
        {pending ? "Reopening…" : label}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-err">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
