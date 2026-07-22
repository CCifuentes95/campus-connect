import Link from "next/link";
import type { DashboardAppointment } from "@/lib/data/student-dashboard";
import { clockTime, dateTile } from "@/lib/format";
import { serviceLabel } from "@/lib/labels";

// A single advising-appointment card (dashboard Lane B + reused by the Appointments list in
// US-04). Navy date tile, service chip, title, time, advisor.
export function AppointmentCard({
  appointment,
}: {
  appointment: DashboardAppointment;
}) {
  const tile = dateTile(appointment.startMs);
  const advisorInitials = appointment.advisorName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      href={`/appointments/${appointment.id}`}
      className="flex items-stretch gap-3.5 rounded-[14px] border border-line bg-card p-3 shadow-[0_1px_2px_rgba(13,44,73,0.04)] transition-shadow hover:shadow-[0_4px_12px_rgba(13,44,73,0.08)]"
    >
      <div className="flex w-[58px] flex-shrink-0 flex-col items-center justify-center rounded-[10px] bg-tile py-2 text-tile-ink">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-tile-ink/70">
          {tile.month}
        </span>
        <span className="text-[20px] font-bold leading-none">{tile.day}</span>
        <span className="text-[10px] font-medium text-tile-ink/70">
          {tile.weekday}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 inline-block rounded-md bg-inset px-2 py-0.5 text-[11px] font-medium text-teal-ink">
          {serviceLabel(appointment.service)}
        </div>
        <h3 className="truncate text-[14px] font-semibold text-ink">
          {appointment.title || serviceLabel(appointment.service)}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-muted">
          <span>{clockTime(appointment.startMs)}</span>
          {appointment.advisorName ? (
            <>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal text-[9px] font-bold text-white">
                  {advisorInitials}
                </span>
                {appointment.advisorName}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
