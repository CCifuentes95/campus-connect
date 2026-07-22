"use client";

// Inbox tab (US-06): Unread / All read view toggle + Today/Earlier grouping, applied
// in-memory over a single fetched list — mirrors the request list's established
// "single fetch, filter client-side" convention (components/requests/requests-list.tsx).
import { useActionState, useMemo, useState } from "react";
import { markAllNotificationsRead, type MarkReadState } from "@/lib/actions/notifications";
import type { NotificationItem } from "@/lib/data/notifications";
import { NotificationRow } from "@/components/notifications/notification-row";

type View = "unread" | "read";

const INITIAL: MarkReadState = { status: "idle" };

function isToday(ms: number | null, now: number): boolean {
  if (!ms) return false;
  return new Date(ms).toDateString() === new Date(now).toDateString();
}

export function NotificationsInbox({
  items,
  now,
}: {
  items: NotificationItem[];
  now: number;
}) {
  const [view, setView] = useState<View>("unread");
  const [, formAction, pending] = useActionState(markAllNotificationsRead, INITIAL);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const visible = view === "unread" ? items.filter((n) => !n.read) : items;
  const groups = useMemo(() => {
    const today = visible.filter((n) => isToday(n.createdAtMs, now));
    const earlier = visible.filter((n) => !isToday(n.createdAtMs, now));
    return [
      { label: "Today", items: today },
      { label: "Earlier", items: earlier },
    ].filter((g) => g.items.length > 0);
  }, [visible, now]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3.5">
        <div
          className="inline-flex gap-0.5 rounded-[10px] border border-field bg-card p-1"
          role="group"
          aria-label="Filter notifications"
        >
          <button
            type="button"
            aria-pressed={view === "unread"}
            onClick={() => setView("unread")}
            className={`rounded-lg px-[15px] py-2 text-[13px] font-semibold ${
              view === "unread" ? "bg-[color:var(--btn2)] text-[color:var(--btn2-text)]" : "text-muted-2"
            }`}
          >
            Unread
          </button>
          <button
            type="button"
            aria-pressed={view === "read"}
            onClick={() => setView("read")}
            className={`rounded-lg px-[15px] py-2 text-[13px] font-semibold ${
              view === "read" ? "bg-[color:var(--btn2)] text-[color:var(--btn2-text)]" : "text-muted-2"
            }`}
          >
            All read
          </button>
        </div>

        {items.length > 0 ? (
          <form action={formAction}>
            <button
              type="submit"
              disabled={pending || unreadCount === 0}
              className="inline-flex items-center gap-2 rounded-[9px] border border-line bg-card px-[15px] py-[9px] text-[13.5px] font-semibold text-ink disabled:cursor-not-allowed disabled:text-muted disabled:opacity-60"
            >
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {pending ? "Marking…" : "Mark all as read"}
            </button>
          </form>
        ) : null}
      </div>

      {groups.length > 0 ? (
        <div className="flex flex-col gap-[22px]">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.6px] text-muted">
                {g.label}
              </div>
              <div className="overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_1px_2px_var(--card-shadow)]">
                {g.items.map((n) => (
                  <NotificationRow key={n.id} item={n} now={now} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
          <div className="mx-auto mb-[18px] flex h-[66px] w-[66px] items-center justify-center rounded-[18px] bg-teal-tint">
            <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <h3 className="mb-2 text-[18px] font-bold text-ink">You&apos;re all caught up</h3>
          <p className="mx-auto max-w-[380px] text-[14px] leading-[1.6] text-body">
            No new notifications right now. Updates about your requests and advising
            appointments will show up here.
          </p>
        </div>
      )}
    </div>
  );
}
