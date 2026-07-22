import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentsList } from "@/components/appointments/appointments-list";
import { nowMs } from "@/lib/advising";
import { getStudentAppointments } from "@/lib/data/appointments";

export const metadata: Metadata = {
  title: "My appointments · CampusConnect",
  description: "Your one-to-one advising sessions, upcoming and past.",
};

export default async function AppointmentsPage() {
  const now = nowMs();
  const appts = await getStudentAppointments();

  return (
    <div className="mx-auto w-full max-w-[1120px] px-8 pb-16 pt-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-[5px] text-[27px] font-bold text-ink">My appointments</h1>
          <p className="text-[14.5px] text-body">Your one-to-one advising sessions, upcoming and past.</p>
        </div>
        <Link
          href="/appointments/new"
          className="inline-flex items-center gap-2 rounded-[11px] bg-gold px-[18px] py-3 text-[14px] font-bold text-navy shadow-[0_4px_12px_rgba(215,165,36,0.28)] hover:bg-gold-hover"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Book advising
        </Link>
      </div>

      {appts.error ? (
        <div className="rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
          <h2 className="mb-2 text-[18px] font-bold text-ink">We couldn&apos;t load your appointments</h2>
          <p className="mx-auto max-w-[400px] text-[14px] leading-[1.6] text-body">
            Something went wrong fetching your sessions. Please refresh the page — if it keeps happening, try again in a few minutes.
          </p>
        </div>
      ) : (
        <AppointmentsList appointments={appts.items} nowMs={now} />
      )}
    </div>
  );
}
