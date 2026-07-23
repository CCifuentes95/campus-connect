import type { Metadata } from "next";
import { ReportsDashboard } from "@/components/admin/reports-dashboard";
import { getReportDataset } from "@/lib/data/reports";
import { nowMs } from "@/lib/notifications";

export const metadata: Metadata = {
  title: "Reports & insight · CampusConnect",
  description: "Program-wide support metrics for the IBU program office.",
};

export default async function AdminReportsPage() {
  const now = nowMs();
  const data = await getReportDataset();

  return (
    <div className="mx-auto w-full max-w-[1320px] px-8 pb-16 pt-[26px]">
      {data.error ? (
        <>
          <h1 className="mb-2 text-[27px] font-bold text-ink">Reports &amp; insight</h1>
          <div className="mt-6 rounded-2xl border border-line bg-card px-8 py-14 text-center shadow-[0_1px_2px_var(--card-shadow)]">
            <h2 className="mb-2 text-[18px] font-bold text-ink">We couldn&apos;t load the reports</h2>
            <p className="mx-auto max-w-[420px] text-[14px] leading-[1.6] text-body">
              Something went wrong fetching the reporting data. Refresh the page — if it keeps
              happening, the tickets index may still be deploying.
            </p>
          </div>
        </>
      ) : (
        <ReportsDashboard tickets={data.tickets} appointments={data.appointments} nowMs={now} />
      )}
    </div>
  );
}
