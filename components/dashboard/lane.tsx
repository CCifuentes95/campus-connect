import Link from "next/link";

type Variant = "a" | "b";

function MessageIcon({ stroke = "#fff", size = 23 }: { stroke?: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CalendarIcon({ stroke = "#fff", size = 22 }: { stroke?: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function PlusIcon({ size = 16, sw = 2.6 }: { size?: number; sw?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// Lane scaffolding for the two-lane dashboard: a tinted header (icon, title, count badge,
// description, primary CTA) over its card list or an empty/error state. Variant a = Support
// requests (teal icon, gold CTA); variant b = Advising appointments (navy icon, navy CTA).
export function Lane({
  variant,
  title,
  description,
  count,
  countNoun,
  cta,
  children,
}: {
  variant: Variant;
  title: string;
  description: string;
  count: number;
  countNoun: string;
  cta: { label: string; href: string };
  children: React.ReactNode;
}) {
  const isA = variant === "a";
  const headClass = isA
    ? "bg-lane-a border-lane-a-border"
    : "bg-lane-b border-lane-b-border";
  const iconWellClass = isA ? "bg-teal-solid" : "bg-tile";
  const countClass = isA
    ? "bg-count-a-bg text-count-a-text"
    : "bg-count-b-bg text-count-b-text";

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_1px_2px_var(--card-shadow)]">
      <div className={`flex min-h-[130px] items-center border-b px-6 py-[22px] ${headClass}`}>
        <div className="flex w-full flex-wrap items-start gap-4">
          <div
            className={`flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-xl ${iconWellClass}`}
          >
            {isA ? <MessageIcon /> : <CalendarIcon />}
          </div>
          <div className="min-w-[170px] flex-1">
            <div className="flex items-center gap-[10px]">
              <h2 className="text-[18px] font-bold text-ink">{title}</h2>
              <span
                className={`whitespace-nowrap rounded-full px-[10px] py-[3px] text-[11px] font-bold ${countClass}`}
              >
                {count} {countNoun}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-[1.5] text-body">{description}</p>
          </div>
          {isA ? (
            <Link
              href={cta.href}
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-[10px] bg-gold px-[18px] py-3 text-[14px] font-bold text-navy shadow-[0_4px_12px_rgba(215,165,36,0.28)] hover:bg-gold-hover"
            >
              <PlusIcon />
              {cta.label}
            </Link>
          ) : (
            <Link
              href={cta.href}
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-[10px] bg-btn2 px-[18px] py-3 text-[14px] font-semibold text-btn2-text hover:bg-btn2-hover"
            >
              <CalendarIcon stroke="currentColor" size={16} />
              {cta.label}
            </Link>
          )}
        </div>
      </div>

      <div className="px-6 pb-6 pt-5">{children}</div>
    </section>
  );
}

/** Inline "couldn't load" state — distinct from a legitimately empty lane (spec). */
export function LaneError({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-alert-border bg-alert-bg px-4 py-6 text-center text-[13px] text-alert-ink">
      We couldn&apos;t load your {label} right now. Please refresh to try again.
    </div>
  );
}

const SUGGESTIONS = [
  "Registration & holds",
  "Transcripts & records",
  "Advising & planning",
];

/** Lane A empty state for a brand-new student. */
export function RequestsEmpty() {
  return (
    <div className="px-3 pb-[14px] pt-[26px] text-center">
      <div className="mx-auto mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-teal-tint">
        <MessageIcon stroke="var(--teal)" size={28} />
      </div>
      <h3 className="mb-2 text-[17px] font-bold text-ink">No requests yet</h3>
      <p className="mx-auto mb-5 max-w-[400px] text-[14px] leading-[1.6] text-body">
        When you need help with a hold, transcript, or fee, start a request with{" "}
        <strong className="text-ink">New request</strong> above — our team takes it from
        there and keeps you posted.
      </p>
      <div className="flex flex-wrap justify-center gap-[10px]">
        {SUGGESTIONS.map((s) => (
          <div
            key={s}
            className="flex items-center gap-2 rounded-[10px] border border-line bg-page px-[13px] py-[9px] text-[12.5px] font-medium text-ink"
          >
            <span className="h-[6px] w-[6px] rounded-full bg-gold" />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lane B empty state for a brand-new student. */
export function AppointmentsEmpty() {
  return (
    <div className="px-3 pb-[14px] pt-[26px] text-center">
      <div className="mx-auto mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-tile-soft">
        <CalendarIcon stroke="var(--ink)" size={27} />
      </div>
      <h3 className="mb-2 text-[17px] font-bold text-ink">No appointments booked</h3>
      <p className="mx-auto max-w-[340px] text-[14px] leading-[1.6] text-body">
        Use <strong className="text-ink">Book advising</strong> above to meet one-to-one with
        an advisor about your courses, career, or next steps.
      </p>
    </div>
  );
}
