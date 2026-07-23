import type { Metadata } from "next";
import Link from "next/link";
import { CompleteAppointmentButton } from "@/components/staff/complete-appointment-button";
import { initialsOf } from "@/components/staff/glyphs";
import { getStaffAppointment } from "@/lib/data/appointments";
import { modeShort } from "@/lib/advising";
import { clockTime, longDateTime } from "@/lib/format";
import { appointmentStatusStyle, serviceLabel } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Appointment · CampusConnect",
};

export default async function StaffAppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appt = await getStaffAppointment(id);

  const back = (
    <Link href="/staff/appointments" className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-muted-2 hover:text-ink">
      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
      Back to schedule
    </Link>
  );

  if (!appt) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-8 pb-16 pt-5">
        {back}
        <div className="rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
          <h1 className="mb-2 text-[20px] font-bold text-ink">Appointment not found</h1>
          <p className="mx-auto max-w-[420px] text-[14px] leading-[1.6] text-body">This appointment doesn&apos;t exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  const badge = appointmentStatusStyle(appt.status);
  const time = appt.endMs ? `${clockTime(appt.startMs)} – ${clockTime(appt.endMs)}` : clockTime(appt.startMs);

  return (
    <div className="mx-auto w-full max-w-[760px] px-8 pb-16 pt-5">
      {back}
      <div className="rounded-2xl border border-line bg-card px-[26px] py-[22px] shadow-[0_1px_2px_var(--card-shadow)]">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[13px] text-muted" translate="no">{appt.code}</span>
          <span className="rounded-md bg-teal-tint px-2.5 py-[3px] text-[12px] font-semibold text-teal">{serviceLabel(appt.service)}</span>
          <span className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold tracking-[0.3px]" style={{ background: badge.tintVar, color: badge.colorVar }}>{badge.label}</span>
        </div>
        <h1 className="mb-4 text-[24px] font-bold leading-[1.25] text-ink">{appt.title || serviceLabel(appt.service)}</h1>

        <dl className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
          <Field label="Student">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: "var(--tile)" }}>{initialsOf(appt.studentName)}</span>
              {appt.studentName}
            </span>
          </Field>
          <Field label="When"><span className="tabular-nums">{longDateTime(appt.startMs)} · {time}</span></Field>
          <Field label="Format">{modeShort(appt.mode, appt.location)}</Field>
          <Field label="Advisor">{appt.advisorName}</Field>
        </dl>

        {appt.status === "booked" ? (
          <div className="mt-6 border-t border-divider pt-5">
            <CompleteAppointmentButton id={appt.id} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-[11px] font-medium uppercase tracking-[0.4px] text-muted">{label}</dt>
      <dd className="text-[14px] font-semibold text-ink">{children}</dd>
    </div>
  );
}
