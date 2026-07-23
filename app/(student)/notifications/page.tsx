import type { Metadata } from "next";
import { getNotifications, getNotificationPrefs } from "@/lib/data/notifications";
import { nowMs } from "@/lib/notifications";
import { NotificationsTabs } from "@/components/notifications/notifications-tabs";
import { FeatureUnavailable } from "@/components/feature-unavailable";
import { isEnabled } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Notifications · CampusConnect",
  description: "Your notification inbox and channel preferences.",
};

export default async function NotificationsPage() {
  if (!isEnabled("notifications")) {
    return (
      <FeatureUnavailable
        title="Notifications are unavailable"
        message="The notifications inbox is temporarily turned off. Please check back later."
      />
    );
  }
  const [result, prefs] = await Promise.all([getNotifications(), getNotificationPrefs()]);
  // Computed once, server-side, and passed down — the client tabs never call Date.now()
  // themselves, so Today/Earlier grouping can't drift between the server and client render.
  const now = nowMs();

  return (
    <div className="mx-auto w-full max-w-[920px] px-8 pb-16 pt-7">
      <h1 className="mb-[18px] text-[28px] font-bold text-ink">Notifications</h1>

      {result.kind === "error" ? (
        <div className="rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
          <h2 className="mb-2 text-[18px] font-bold text-ink">
            We couldn&apos;t load your notifications
          </h2>
          <p className="mx-auto max-w-[400px] text-[14px] leading-[1.6] text-body">
            Something went wrong fetching your notifications. Please refresh the page — if it
            keeps happening, try again in a few minutes.
          </p>
        </div>
      ) : (
        <NotificationsTabs items={result.items} prefs={prefs} now={now} />
      )}
    </div>
  );
}
