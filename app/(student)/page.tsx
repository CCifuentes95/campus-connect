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

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export default async function StudentDashboardPage() {
  // Reads run through FirebaseServerApp under the signed-in user (firestore.rules apply).
  const [profile, tickets, appointments] = await Promise.all([
    getStudentProfile(),
    getRecentTickets(),
    getUpcomingAppointments(),
  ]);

  const first = firstName(profile?.displayName ?? profile?.email);
  const openCount = tickets.items.filter((t) => isOpenStatus(t.status)).length;
  const waitingCount = tickets.items.filter(
    (t) => t.status === "waiting_for_student",
  ).length;
  const upcomingCount = appointments.items.length;
  const ticketPreview = tickets.items.slice(0, PREVIEW);
  const appointmentPreview = appointments.items.slice(0, PREVIEW);

  // "Brand-new student" hero only when both lanes loaded clean and empty.
  const isNew =
    !tickets.error &&
    !appointments.error &&
    tickets.items.length === 0 &&
    appointments.items.length === 0;

  const heroKicker = isNew ? `Welcome, ${first}` : `${timeGreeting()}, ${first}`;
  const heroTitle = isNew
    ? "Let's get you started"
    : waitingCount > 0
      ? `${waitingCount} ${plural(waitingCount, "request needs", "requests need")} your reply`
      : upcomingCount > 0
        ? `${upcomingCount} upcoming ${plural(upcomingCount, "appointment", "appointments")}`
        : "You're all caught up";
  const heroSubtitle = isNew
    ? "CampusConnect gives you two ways to get support, shown side by side below. Start with whichever fits what you need."
    : "Your two support tracks are shown side by side below — help tickets on the left, advising appointments on the right.";

  return (
    <div className="mx-auto w-full max-w-[1200px] px-8 pb-16 pt-6">
      <header className="mb-[26px]">
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[1.5px] text-gold-ink">
          {heroKicker}
        </div>
        <h1 className="mb-2 text-balance text-[30px] font-bold leading-[1.2] text-ink">
          {heroTitle}
        </h1>
        <p className="max-w-[640px] text-[15px] leading-[1.6] text-body">{heroSubtitle}</p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Lane A · Support requests */}
        <Lane
          variant="a"
          title="Support requests"
          description="Help tickets our team investigates and resolves for you — holds, records, fees, and more."
          count={openCount}
          countNoun="open"
          cta={{ label: "New request", href: "/requests/new" }}
        >
          {tickets.error ? (
            <LaneError label="requests" />
          ) : ticketPreview.length === 0 ? (
            <RequestsEmpty />
          ) : (
            <div className="flex flex-col gap-[14px]">
              {ticketPreview.map((t) => (
                <RequestCard key={t.id} ticket={t} />
              ))}
              <Link
                href="/requests"
                className="mt-[2px] self-start text-[13px] font-semibold text-teal hover:text-ink"
              >
                View all requests <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </Lane>

        {/* Lane B · Advising appointments */}
        <Lane
          variant="b"
          title="Advising appointments"
          description="One-to-one meetings you book with an advisor to plan courses, career, and next steps."
          count={upcomingCount}
          countNoun="upcoming"
          cta={{ label: "Book advising", href: "/appointments/new" }}
        >
          {appointments.error ? (
            <LaneError label="appointments" />
          ) : appointmentPreview.length === 0 ? (
            <AppointmentsEmpty />
          ) : (
            <div className="flex flex-col gap-[14px]">
              {appointmentPreview.map((a) => (
                <AppointmentCard key={a.id} appointment={a} />
              ))}
              <Link
                href="/appointments"
                className="mt-[2px] self-start text-[13px] font-semibold text-teal hover:text-ink"
              >
                View all appointments <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </Lane>
      </div>
    </div>
  );
}
