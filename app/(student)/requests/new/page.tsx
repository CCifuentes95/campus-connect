import type { Metadata } from "next";
import Link from "next/link";
import { RequestForm } from "@/components/requests/request-form";
import { FeatureUnavailable } from "@/components/feature-unavailable";
import { isEnabled } from "@/lib/flags";

export const metadata: Metadata = {
  title: "New support request · CampusConnect",
  description: "Submit a new support request to the IBU student support team.",
};

export default function NewRequestPage() {
  if (!isEnabled("submit-request")) {
    return (
      <FeatureUnavailable
        title="Submitting requests is unavailable"
        message="New support requests are temporarily turned off. Please check back later."
        backHref="/requests"
        backLabel="Back to my requests"
      />
    );
  }
  return (
    <div className="mx-auto w-full max-w-[1120px] px-8 pb-16 pt-[22px]">
      <Link
        href="/requests"
        className="mb-4 inline-flex items-center gap-[7px] text-[13px] font-semibold text-muted-2 hover:text-ink"
      >
        <svg
          aria-hidden="true"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to requests
      </Link>

      <RequestForm />
    </div>
  );
}
