"use client";

import { useActionState, useEffect, useRef } from "react";
import { replyToTicket, type ReplyState } from "@/lib/actions/tickets";

const INITIAL: ReplyState = { status: "idle" };

/**
 * The "Add a comment" leaf on the Track Ticket page (US-05). Shown only for in-flight statuses
 * (new / assigned / waiting_for_student) — the page swaps in the reopen affordance for done
 * tickets. Posting calls `replyToTicket`, which writes a public `student_reply` event and, when
 * the ticket was `waiting_for_student`, transitions it back to `assigned`.
 */
export function CommentBox({
  ticketId,
  authorInitials,
}: {
  ticketId: string;
  authorInitials: string;
}) {
  const [state, formAction, pending] = useActionState(replyToTicket, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the textarea once a reply posts.
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  const errorId = state.status === "error" ? "comment-error" : undefined;

  return (
    <div className="border-t border-divider pt-5">
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="ticketId" value={ticketId} />
        <label
          htmlFor="comment-message"
          className="mb-[9px] block text-[13.5px] font-semibold text-ink"
        >
          Add a comment
        </label>
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-[#064948] text-[13px] font-bold text-white"
          >
            {authorInitials}
          </span>
          <div className="flex-1">
            <textarea
              id="comment-message"
              name="message"
              rows={3}
              required
              maxLength={1000}
              placeholder="Write a reply to your support team…"
              aria-invalid={state.status === "error"}
              aria-describedby={errorId}
              className="w-full resize-y rounded-[11px] border border-field bg-[color:var(--field-bg)] px-[13px] py-3 text-[14px] text-ink placeholder:text-muted"
            />
            {state.status === "error" ? (
              <p id="comment-error" role="alert" className="mt-2 text-[13px] font-medium text-err">
                {state.message}
              </p>
            ) : null}
            <div className="mt-[11px] flex items-center justify-end">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-[10px] bg-gold px-5 py-[11px] text-[14px] font-bold text-navy hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
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
                {pending ? "Posting…" : "Post comment"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
