"use client";

// Main Inbox / Preferences tab switcher (US-06). Client state, not searchParams — both tabs'
// data is already fetched server-side and passed down, so switching is instant.
import { useMemo, useState } from "react";
import type { NotificationItem } from "@/lib/data/notifications";
import type { NotificationPrefs } from "@/lib/notifications";
import { NotificationsInbox } from "@/components/notifications/notifications-inbox";
import { PreferencesForm } from "@/components/notifications/preferences-form";

type Tab = "inbox" | "preferences";

export function NotificationsTabs({
  items,
  prefs,
  now,
}: {
  items: NotificationItem[];
  prefs: NotificationPrefs;
  now: number;
}) {
  const [tab, setTab] = useState<Tab>("inbox");
  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const tabClass = (on: boolean) =>
    `inline-flex items-center border-b-[2.5px] pb-3 text-[15px] ${
      on
        ? "border-gold font-bold text-ink"
        : "border-transparent font-medium text-muted"
    }`;

  return (
    <div>
      <div role="tablist" aria-label="Notifications" className="mb-[22px] flex gap-[26px] border-b border-line">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "inbox"}
          aria-controls="notifications-panel"
          onClick={() => setTab("inbox")}
          className={tabClass(tab === "inbox")}
        >
          Inbox
          {unreadCount > 0 ? (
            <span className="ml-[7px] rounded-full bg-gold px-2 py-px text-[11px] font-bold text-navy">
              {unreadCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "preferences"}
          aria-controls="notifications-panel"
          onClick={() => setTab("preferences")}
          className={tabClass(tab === "preferences")}
        >
          Preferences
        </button>
      </div>

      <div id="notifications-panel" role="tabpanel">
        {tab === "inbox" ? (
          <NotificationsInbox items={items} now={now} />
        ) : (
          <PreferencesForm initialPrefs={prefs} />
        )}
      </div>
    </div>
  );
}
