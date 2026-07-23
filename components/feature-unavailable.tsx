import Link from "next/link";

// Rendered in place of a flow when its feature flag is off (route-level gate). Keeps the nav +
// layout intact and tells the user the feature is unavailable, rather than 404-ing.
export function FeatureUnavailable({
  title = "This feature is currently unavailable",
  message = "It's been temporarily turned off. Please check back later.",
  backHref = "/",
  backLabel = "Back to dashboard",
}: {
  title?: string;
  message?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[720px] px-8 pb-16 pt-10">
      <div className="rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
        <div className="mx-auto mb-5 flex h-[66px] w-[66px] items-center justify-center rounded-[18px] bg-inset">
          <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="mb-2 text-[20px] font-bold text-ink">{title}</h1>
        <p className="mx-auto mb-6 max-w-[420px] text-[14px] leading-[1.6] text-body">{message}</p>
        <Link href={backHref} className="inline-flex items-center gap-2 rounded-[11px] border border-[color:var(--field)] bg-card px-[18px] py-3 text-[14px] font-semibold text-ink hover:border-[color:var(--muted)]">
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
