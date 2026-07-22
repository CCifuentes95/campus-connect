import type { DashboardAppointment } from "@/lib/data/student-dashboard";
import { clockTime, dateTile } from "@/lib/format";
import { serviceLabel } from "@/lib/labels";

// An advising-appointment card (dashboard Lane B + reused by the Appointments list in US-04).
// Navy date tile (gold month), service chip, title, time with clock icon, advisor with avatar.
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
    <div className="flex gap-4 rounded-[14px] border border-line bg-card p-[18px] shadow-[0_1px_2px_var(--card-shadow)] transition-shadow hover:border-[color:var(--card-hover-border)] hover:shadow-[0_6px_20px_var(--card-hover-shadow)]">
      <div className="w-[58px] flex-shrink-0 rounded-[11px] bg-tile py-[10px] text-center text-white">
        <div className="text-[11px] font-semibold uppercase tracking-[0.5px] text-gold">
          {tile.month}
        </div>
        <div className="text-[23px] font-bold leading-[1.1] tabular-nums">{tile.day}</div>
        <div className="text-[11px] font-medium text-navy-muted">{tile.weekday}</div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2 inline-block rounded-md bg-teal-tint px-[9px] py-[3px] text-[12px] font-semibold text-teal">
          {serviceLabel(appointment.service)}
        </div>
        <h3 className="mb-[10px] line-clamp-2 text-[15px] font-semibold leading-[1.35] text-ink">
          {appointment.title || serviceLabel(appointment.service)}
        </h3>
        <div className="mb-[5px] flex items-center gap-2 text-[13px] text-body">
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {clockTime(appointment.startMs)}
        </div>
        {appointment.advisorName ? (
          <div className="flex items-center gap-2 text-[13px] text-body">
            <span aria-hidden="true" className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-teal-solid text-[9px] font-bold text-white">
              {advisorInitials}
            </span>
            {appointment.advisorName}
          </div>
        ) : null}
      </div>
    </div>
  );
}
