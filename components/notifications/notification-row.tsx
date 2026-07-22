"use client";

// One Inbox row (US-06). Clicking it both navigates to the related ticket/appointment and
// marks the notification read (matches the mockup, which shows no separate per-row mark-read
// control) — the mark-read call is fire-and-forget alongside the Link's normal navigation.
import { useTransition } from "react";
import Link from "next/link";
import { markNotificationRead, type MarkReadState } from "@/lib/actions/notifications";
import { notificationTileKind } from "@/lib/notifications";
import { relativeTime } from "@/lib/format";
import type { NotificationItem } from "@/lib/data/notifications";

function MessageIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function NotificationRow({ item, now }: { item: NotificationItem; now: number }) {
  const [, startTransition] = useTransition();
  const kind = notificationTileKind(item.type);

  function markRead() {
    if (item.read) return;
    const formData = new FormData();
    formData.set("notificationId", item.id);
    startTransition(() => {
      markNotificationRead({ status: "idle" } as MarkReadState, formData);
    });
  }

  return (
    <Link
      href={item.link || "/notifications"}
      onClick={markRead}
      className={`flex items-start gap-3.5 border-b border-divider px-[18px] py-4 last:border-b-0 hover:bg-divider ${
        item.read ? "bg-transparent" : "bg-[color:var(--unread-bg)]"
      }`}
    >
      <span
        className={`flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] ${
          kind === "ticket" ? "bg-teal-solid" : "bg-tile"
        }`}
      >
        {kind === "ticket" ? <MessageIcon /> : <CalendarIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2.5">
          <span
            className={`text-[14.5px] text-ink ${item.read ? "font-medium" : "font-bold"}`}
          >
            {item.title}
          </span>
          <span className="flex-shrink-0 whitespace-nowrap text-[12px] text-muted">
            {relativeTime(item.createdAtMs, now)}
          </span>
        </div>
        <div className="mt-[3px] text-[13.5px] leading-[1.5] text-body">{item.body}</div>
      </div>
      {!item.read ? (
        <span
          aria-hidden="true"
          className="mt-1.5 h-[9px] w-[9px] flex-shrink-0 rounded-full bg-gold"
        />
      ) : null}
    </Link>
  );
}
