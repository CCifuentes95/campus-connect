"use client";

// Mark-completed action for the staff appointment detail (US-07). Only rendered when the
// appointment is `booked`. Runs the completeAppointment server action and refreshes the RSC.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeAppointment } from "@/lib/actions/appointments";

export function CompleteAppointmentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      const res = await completeAppointment({ status: "idle" }, fd);
      if (res.status === "error") setError(res.message);
      else router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[11px] bg-gold px-3 py-[13px] text-[14.5px] font-bold text-navy shadow-[0_4px_12px_rgba(215,165,36,0.28)] hover:bg-gold-hover disabled:opacity-60"
      >
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        Mark completed
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] font-medium text-[color:var(--err)]">{error}</p>
      ) : null}
    </div>
  );
}
