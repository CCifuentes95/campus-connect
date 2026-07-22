import Link from "next/link";

// Lane scaffolding for the two-lane student dashboard: a header (title, count badge,
// description, primary CTA) over its card list or an empty/error state.

export function Lane({
  title,
  description,
  count,
  countNoun,
  cta,
  children,
}: {
  title: string;
  description: string;
  count: number;
  countNoun: string; // e.g. "open" | "upcoming"
  cta: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-line bg-card p-5 shadow-[0_1px_2px_rgba(13,44,73,0.04)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-[18px] font-bold text-ink">{title}</h2>
            <span className="rounded-full bg-inset px-2.5 py-0.5 text-[12px] font-semibold text-body">
              {count} {countNoun}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted">{description}</p>
        </div>
        <Link
          href={cta.href}
          className="flex-shrink-0 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-ink hover:bg-gold-hover"
        >
          {cta.label}
        </Link>
      </div>
      {children}
    </section>
  );
}

/** Inline "couldn't load" state — distinct from a legitimately empty lane (spec). */
export function LaneError({ label }: { label: string }) {
  return (
    <div className="rounded-[12px] border border-alert-border bg-alert-bg px-4 py-6 text-center text-[13px] text-alert-ink">
      We couldn&apos;t load your {label} right now. Please refresh to try again.
    </div>
  );
}

const SUGGESTIONS = [
  { label: "Registration & holds", category: "registration" },
  { label: "Transcripts & records", category: "records" },
  { label: "Advising & planning", category: "advising" },
];

/** Lane A empty state for a brand-new student. */
export function RequestsEmpty() {
  return (
    <div className="rounded-[12px] border border-dashed border-field bg-inset px-4 py-8 text-center">
      <p className="text-[15px] font-semibold text-ink">No requests yet</p>
      <p className="mx-auto mt-1 max-w-[320px] text-[13px] text-muted">
        Need a hand with something? Start a support request and a specialist will follow up.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <Link
            key={s.category}
            href={`/requests/new?category=${s.category}`}
            className="rounded-full border border-field bg-card px-3 py-1.5 text-[12px] font-medium text-body hover:border-accent hover:text-ink"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Lane B empty state for a brand-new student. */
export function AppointmentsEmpty() {
  return (
    <div className="rounded-[12px] border border-dashed border-field bg-inset px-4 py-8 text-center">
      <p className="text-[15px] font-semibold text-ink">No appointments booked</p>
      <p className="mx-auto mt-1 max-w-[300px] text-[13px] text-muted">
        Book time with an advisor for academic planning, financial aid, or career support.
      </p>
    </div>
  );
}
