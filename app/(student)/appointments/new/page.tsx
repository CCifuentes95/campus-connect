import type { Metadata } from "next";
import Link from "next/link";
import { BookingWizard } from "@/components/appointments/booking-wizard";
import { FeatureUnavailable } from "@/components/feature-unavailable";
import { nowMs, upcomingBusinessDays } from "@/lib/advising";
import { getStudentAppointments } from "@/lib/data/appointments";
import { isEnabled } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Book advising · CampusConnect",
  description: "Book a one-to-one advising appointment with an IBU advisor.",
};

export default async function NewAppointmentPage() {
  if (!isEnabled("book-appointment")) {
    return (
      <FeatureUnavailable
        title="Booking is unavailable"
        message="Advising appointment booking is temporarily turned off. Please check back later."
        backHref="/appointments"
        backLabel="Back to my appointments"
      />
    );
  }
  const now = nowMs();
  const dateChips = upcomingBusinessDays(8, now);

  // Existing booked appointments seed the wizard's conflict-greying (and the action re-checks).
  const appts = await getStudentAppointments();
  const existing = appts.items
    .filter((a) => a.status === "booked" && a.endMs != null)
    .map((a) => ({ startMs: a.startMs, endMs: a.endMs as number }));

  return (
    <div className="mx-auto w-full max-w-[1120px] px-8 pb-16 pt-[22px]">
      <Link
        href="/appointments"
        className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-muted-2 hover:text-ink"
      >
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to appointments
      </Link>

      <BookingWizard dateChips={dateChips} nowMs={now} existing={existing} />
    </div>
  );
}
