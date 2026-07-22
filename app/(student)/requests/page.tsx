import type { Metadata } from "next";
import Link from "next/link";
import { RequestsList } from "@/components/requests/requests-list";
import { getStudentTickets } from "@/lib/data/requests";

export const metadata: Metadata = {
  title: "My support requests · CampusConnect",
  description: "Track every help ticket you've opened and its current status.",
};

export default async function RequestsPage() {
  const tickets = await getStudentTickets();

  return (
    <div className="mx-auto w-full max-w-[1120px] px-8 pb-16 pt-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-[5px] text-[27px] font-bold text-ink">
            My support requests
          </h1>
          <p className="text-[14.5px] text-body">
            Track every help ticket you&apos;ve opened and its current status.
          </p>
        </div>
        <Link
          href="/requests/new"
          className="inline-flex items-center gap-2 rounded-[11px] bg-gold px-[18px] py-3 text-[14px] font-bold text-navy shadow-[0_4px_12px_rgba(215,165,36,0.28)] hover:bg-gold-hover"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New support request
        </Link>
      </div>

      {tickets.error ? (
        <div className="rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
          <h2 className="mb-2 text-[18px] font-bold text-ink">
            We couldn&apos;t load your requests
          </h2>
          <p className="mx-auto max-w-[400px] text-[14px] leading-[1.6] text-body">
            Something went wrong fetching your tickets. Please refresh the page — if
            it keeps happening, try again in a few minutes.
          </p>
        </div>
      ) : (
        <RequestsList tickets={tickets.items} />
      )}
    </div>
  );
}
