import type { Metadata } from "next";
import { AdvisorSchedule } from "@/components/staff/advisor-schedule";
import { nowMs } from "@/lib/advising";
import { getAdvisorAppointments } from "@/lib/data/appointments";

export const metadata: Metadata = {
  title: "My advising schedule · CampusConnect",
  description: "Advising sessions students have booked with you.",
};

export default async function AdvisorAppointmentsPage() {
  const now = nowMs();
  const appts = await getAdvisorAppointments();

  return (
    <div className="mx-auto w-full max-w-[1120px] px-8 pb-16 pt-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-[5px] text-[27px] font-bold text-ink">My advising schedule</h1>
          <p className="text-[14.5px] text-body">Advising sessions students have booked with you, upcoming and past.</p>
        </div>
        <button
          type="button"
          disabled
          title="Availability management is coming soon"
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-[11px] border border-[color:var(--sbtn-border)] bg-[color:var(--sbtn-bg)] px-[18px] py-3 text-[14px] font-semibold text-[color:var(--sbtn-text)] opacity-70"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          Set availability
        </button>
      </div>

      {appts.error ? (
        <div className="rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
          <h2 className="mb-2 text-[18px] font-bold text-ink">We couldn&apos;t load your schedule</h2>
          <p className="mx-auto max-w-[400px] text-[14px] leading-[1.6] text-body">
            Something went wrong fetching your sessions. Refresh the page — if it keeps happening, the appointments index may still be deploying.
          </p>
        </div>
      ) : (
        <AdvisorSchedule appointments={appts.items} nowMs={now} />
      )}
    </div>
  );
}
