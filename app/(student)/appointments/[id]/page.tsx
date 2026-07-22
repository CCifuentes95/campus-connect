import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppointmentActions } from "@/components/appointments/appointment-actions";
import { modeLabel, nowMs, upcomingBusinessDays } from "@/lib/advising";
import { getAppointment, getStudentAppointments } from "@/lib/data/appointments";
import { clockTime } from "@/lib/format";
import { appointmentStatusStyle, serviceLabel } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Appointment · CampusConnect",
};

function fullDateTime(startMs: number, endMs: number | null): string {
  const date = new Date(startMs).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = endMs ? `${clockTime(startMs)} – ${clockTime(endMs)}` : clockTime(startMs);
  return `${date} · ${time}`;
}

function StatusBadge({ status }: { status: string }) {
  const s = appointmentStatusStyle(status);
  return (
    <span
      className="inline-flex items-center gap-[7px] rounded-full px-3.5 py-1.5 text-[12.5px] font-bold tracking-[0.3px]"
      style={{ background: s.tintVar, color: s.colorVar }}
    >
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {status === "cancelled" ? (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </>
        ) : (
          <path d="M20 6 9 17l-5-5" />
        )}
      </svg>
      {s.label}
    </span>
  );
}

function Row({ icon, label, value, action }: { icon: React.ReactNode; label: string; value: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[13px] px-4 py-3.5">
      <span className="flex-shrink-0 text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-muted">{label}</div>
        <div className="text-[14px] font-semibold text-ink">{value}</div>
      </div>
      {action}
    </div>
  );
}

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appt = await getAppointment(id);
  if (!appt) notFound();

  const now = nowMs();
  const dateChips = upcomingBusinessDays(8, now);
  const others = (await getStudentAppointments()).items
    .filter((a) => a.id !== id && a.status === "booked" && a.endMs != null)
    .map((a) => ({ startMs: a.startMs, endMs: a.endMs as number }));

  const initials = appt.advisorName.split(/\s+/).filter(Boolean).map((w) => w[0]!).join("").slice(0, 2).toUpperCase();
  const cancelled = appt.status === "cancelled";

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col px-6 pb-16 pt-7">
      <Link href="/appointments" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-muted-2 hover:text-ink">
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to appointments
      </Link>

      <div className={`rounded-[20px] border border-line bg-card px-8 py-8 text-center shadow-[0_4px_24px_var(--card-shadow)] ${cancelled ? "opacity-70" : ""}`}>
        <StatusBadge status={appt.status} />

        <h1 className="mb-1 mt-[18px] text-[22px] font-bold leading-[1.3] text-ink">{serviceLabel(appt.service)}</h1>
        <p className="mb-6 text-[15px] text-body">with {appt.advisorName}</p>

        <div className="mb-6 inline-flex items-center gap-[11px] rounded-[14px] border border-line bg-page py-[11px] pl-3 pr-[18px]">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--tile)] text-[14px] font-bold text-white">{initials}</span>
          <div className="text-left">
            <div className="text-[11px] text-muted">Advisor</div>
            <div className="text-[15px] font-semibold text-ink">{appt.advisorName}</div>
          </div>
        </div>

        <div className="mb-[22px] overflow-hidden rounded-[14px] border border-line text-left">
          <div className="border-b border-divider">
            <Row
              label="Date & time"
              value={fullDateTime(appt.startMs, appt.endMs)}
              icon={<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
            />
          </div>
          <div className="border-b border-divider">
            <Row
              label="Format"
              value={modeLabel(appt.mode, appt.location)}
              icon={<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>}
            />
          </div>
          <Row
            label="Booking reference"
            value={`#${appt.code}`}
            icon={<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><path d="M9 9h6M9 13h4" /></svg>}
          />
        </div>

        {appt.notes ? (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl bg-teal-tint px-[15px] py-3 text-left">
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-px flex-shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            <div className="text-[13.5px] leading-[1.5] text-ink"><strong>Note:</strong> {appt.notes}</div>
          </div>
        ) : null}

        <AppointmentActions
          id={appt.id}
          status={appt.status}
          mode={appt.mode}
          service={appt.service}
          dateChips={dateChips}
          nowMs={now}
          existing={others}
        />
      </div>
    </div>
  );
}
