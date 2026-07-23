import type { Metadata } from "next";
import { TriageBoard } from "@/components/staff/triage-board";
import { FeatureUnavailable } from "@/components/feature-unavailable";
import { getSessionUser } from "@/lib/firebase/session";
import { getStaffRoster } from "@/lib/data/staff";
import { getTriageBoard } from "@/lib/data/staff-tickets";
import { isEnabled } from "@/lib/flags";
import { nowMs } from "@/lib/notifications";

export const metadata: Metadata = {
  title: "Triage board · CampusConnect",
  description: "Prioritise incoming student requests and assign owners.",
};

export default async function TriageBoardPage() {
  if (!isEnabled("staff-triage")) {
    return (
      <FeatureUnavailable
        title="The triage board is unavailable"
        message="Staff triage is temporarily turned off. Please check back later."
      />
    );
  }
  const now = nowMs();
  const [user, board, roster] = await Promise.all([
    getSessionUser(),
    getTriageBoard(),
    getStaffRoster(),
  ]);

  const meUid = user?.uid ?? "";
  const meName =
    roster.find((s) => s.uid === meUid)?.displayName ?? user?.email ?? "Me";

  return (
    <div className="mx-auto w-full max-w-[1320px] px-8 pb-16 pt-[26px]">
      <div className="mb-[22px]">
        <h1 className="mb-[5px] text-[27px] font-bold text-ink">Triage board</h1>
        <p className="max-w-[640px] text-[14.5px] leading-[1.5] text-body">
          Prioritise incoming student requests and assign owners. Unassigned work is pulled to the top.
        </p>
      </div>

      {board.error ? (
        <div className="rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
          <h2 className="mb-2 text-[18px] font-bold text-ink">We couldn&apos;t load the queue</h2>
          <p className="mx-auto max-w-[420px] text-[14px] leading-[1.6] text-body">
            Something went wrong fetching requests. Refresh the page — if it keeps happening, the tickets
            index may still be deploying.
          </p>
        </div>
      ) : (
        <TriageBoard tickets={board.tickets} roster={roster} meUid={meUid} meName={meName} nowMs={now} />
      )}
    </div>
  );
}
