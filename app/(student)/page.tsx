import Link from "next/link";
import { AppointmentCard } from "@/components/dashboard/appointment-card";
import {
  AppointmentsEmpty,
  Lane,
  LaneError,
  RequestsEmpty,
} from "@/components/dashboard/lane";
import { RequestCard } from "@/components/dashboard/request-card";
import {
  getRecentTickets,
  getStudentProfile,
  getUpcomingAppointments,
} from "@/lib/data/student-dashboard";
import { firstName } from "@/lib/format";
import { isOpenStatus } from "@/lib/labels";

// How many cards each lane previews on the dashboard (full lists live in US-04/US-05).
const PREVIEW = 3;

export default async function StudentDashboardPage() {
  // Reads run through FirebaseServerApp under the signed-in user (firestore.rules apply).
  // Fetch the three sources in parallel; each already handles its own errors.
  const [profile, tickets, appointments] = await Promise.all([
    getStudentProfile(),
    getRecentTickets(),
    getUpcomingAppointments(),
  ]);

  const openCount = tickets.items.filter((t) => isOpenStatus(t.status)).length;
  const upcomingCount = appointments.items.length;
  const ticketPreview = tickets.items.slice(0, PREVIEW);
  const appointmentPreview = appointments.items.slice(0, PREVIEW);

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-10">
      <header className="mb-8">
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-widest text-teal-ink">
          CampusConnect
        </div>
        <h1 className="text-[30px] font-bold text-ink">
          Good to see you, {firstName(profile?.displayName ?? profile?.email)}
        </h1>
        <p className="mt-1 max-w-[560px] text-[15px] text-body">
          Here&apos;s a look at your support requests and advising appointments.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Lane A · Support requests */}
        <Lane
          title="Support requests"
          description="Track the academic support you've asked for."
          count={openCount}
          countNoun="open"
          cta={{ label: "New request", href: "/requests/new" }}
        >
          {tickets.error ? (
            <LaneError label="requests" />
          ) : ticketPreview.length === 0 ? (
            <RequestsEmpty />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {ticketPreview.map((t) => (
                  <RequestCard key={t.id} ticket={t} />
                ))}
              </div>
              <Link
                href="/requests"
                className="mt-4 inline-block text-[13px] font-semibold text-ink hover:text-teal-ink"
              >
                View all requests →
              </Link>
            </>
          )}
        </Lane>

        {/* Lane B · Advising appointments */}
        <Lane
          title="Advising appointments"
          description="Your upcoming sessions with advisors."
          count={upcomingCount}
          countNoun="upcoming"
          cta={{ label: "Book advising", href: "/appointments/new" }}
        >
          {appointments.error ? (
            <LaneError label="appointments" />
          ) : appointmentPreview.length === 0 ? (
            <AppointmentsEmpty />
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {appointmentPreview.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} />
                ))}
              </div>
              <Link
                href="/appointments/new"
                className="mt-4 inline-block rounded-[12px] border border-dashed border-field px-4 py-2.5 text-center text-[13px] font-medium text-body hover:border-accent hover:text-ink"
              >
                + Book another appointment
              </Link>
            </>
          )}
        </Lane>
      </div>
    </div>
  );
}
