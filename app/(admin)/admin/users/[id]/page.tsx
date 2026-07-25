import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeftGlyph, CheckGlyph } from "@/components/admin/glyphs";
import { UserDetailForm } from "@/components/admin/user-detail-form";
import { ACCESS_SUMMARY, UI_ROLE_LABEL } from "@/lib/admin-users";
import { getAdminUser, getUserActivity } from "@/lib/data/admin-users";
import { getSessionUser } from "@/lib/firebase/session";
import { joinedDate, relativeTime } from "@/lib/format";
import { staffStatusLabel } from "@/lib/labels";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  // getAdminUser is React-cached, so this shares the page's read rather than adding one.
  const user = await getAdminUser((await params).id);
  return {
    title: user?.displayName
      ? `${user.displayName} · People & access · CampusConnect`
      : "User profile · CampusConnect",
    description: "Edit a CampusConnect account's profile, role and access.",
  };
}

/** Ticket status → the activity row's leading dot, matching the mockup's warn/teal/ok. */
function statusDot(status: string): string {
  if (status === "waiting_for_student") return "var(--warn)";
  if (status === "resolved" || status === "closed") return "var(--ok)";
  return "var(--teal)";
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const user = await getAdminUser(id);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-8 pb-[72px] pt-[22px] max-[560px]:px-4">
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-[7px] text-[13.5px] font-semibold text-teal hover:text-ink"
      >
        <ArrowLeftGlyph />
        All people
      </Link>

      {!user ? (
        // Missing and forbidden are deliberately conflated so the screen never leaks
        // whether an account exists (the US-05 convention).
        <div className="rounded-2xl border border-line bg-card p-[44px_32px] text-center shadow-[0_1px_2px_var(--card-shadow)]">
          <h1 className="mb-2 text-[20px] font-bold text-ink">Account not found</h1>
          <p className="mb-5 text-[14px] text-body">
            This user may have been deleted. Pick someone from the list instead.
          </p>
          <Link
            href="/admin/users"
            className="inline-flex rounded-[11px] bg-gold px-[18px] py-[11px] text-[14px] font-bold text-[#0d2c49] hover:bg-gold-hover"
          >
            Back to people
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-[1.55fr_1fr] items-start gap-[18px] max-[980px]:grid-cols-1">
          <div>
            <UserDetailForm user={user} isSelf={user.id === session.uid} />
          </div>
          {/* The sidebar's activity read scans the ticket collection; streaming it keeps the
              edit form — the reason you opened this page — from waiting on it. */}
          <Suspense fallback={<SidebarSkeleton />}>
            <Sidebar user={user} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-[18px]" aria-hidden>
      {[136, 210, 168].map((h) => (
        <div
          key={h}
          style={{ height: h }}
          className="rounded-2xl border border-line bg-card shadow-[0_1px_2px_var(--card-shadow)]"
        />
      ))}
    </div>
  );
}

async function Sidebar({ user }: { user: Awaited<ReturnType<typeof getAdminUser>> }) {
  if (!user) return null;
  const isStudent = user.uiRole === "student";
  const activity = await getUserActivity(user.id, isStudent);

  const meta: { label: string; value: string; noTranslate?: boolean }[] = [
    { label: "Account ID", value: user.id, noTranslate: true },
    { label: "Joined", value: joinedDate(user.createdAtMs) },
    { label: "Role", value: UI_ROLE_LABEL[user.uiRole] },
    isStudent
      ? { label: "Student ID", value: user.studentId || "—" }
      : { label: "Department", value: user.dept || "—" },
  ];

  return (
    <div className="flex flex-col gap-[18px]">
      <section className="rounded-2xl border border-line bg-card p-[20px_22px] shadow-[0_1px_2px_var(--card-shadow)]">
        <h2 className="mb-3.5 text-[15px] font-bold text-ink">Account</h2>
        <div className="flex flex-col gap-3">
          {meta.map((m) => (
            <div key={m.label} className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted">{m.label}</span>
              <span
                className="min-w-0 truncate text-right text-[13px] font-semibold text-ink"
                translate={m.noTranslate ? "no" : undefined}
              >
                {m.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-card p-[20px_22px] shadow-[0_1px_2px_var(--card-shadow)]">
        <div className="mb-1.5 flex items-center justify-between gap-2.5">
          <h2 className="text-[15px] font-bold text-ink">
            {isStudent ? "Recent activity" : "Current workload"}
          </h2>
          <Link href="/staff/triage" className="text-[12.5px] font-semibold text-teal hover:text-ink">
            Open board →
          </Link>
        </div>
        <p className="mb-3.5 text-[12.5px] text-muted">
          {isStudent
            ? "Requests on this account."
            : "Tickets currently assigned to them."}
        </p>
        {activity.length === 0 ? (
          <p className="text-[13px] text-body">
            {isStudent ? "No requests yet." : "Nothing assigned right now."}
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {activity.map((a) => (
              <Link
                key={a.id}
                href={`/staff/requests/${a.id}`}
                className="flex items-center gap-[11px] rounded-[11px] border border-line p-[11px_12px] hover:border-muted hover:bg-divider"
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: statusDot(a.status) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">
                    {a.title}
                  </span>
                  <span className="block text-[12px] text-muted">
                    <span translate="no">{a.code}</span> · {staffStatusLabel(a.status)}
                    {a.updatedAtMs ? ` · ${relativeTime(a.updatedAtMs)}` : ""}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-[20px_22px] shadow-[0_1px_2px_var(--card-shadow)]">
        <h2 className="mb-1.5 text-[15px] font-bold text-ink">Access summary</h2>
        <p className="mb-3.5 text-[12.5px] text-muted">
          What this role can reach in CampusConnect.
        </p>
        <div className="flex flex-col gap-2.5">
          {ACCESS_SUMMARY[user.uiRole].map((line) => (
            <div key={line} className="flex items-center gap-[9px]">
              <span className="text-[var(--ok)]">
                <CheckGlyph size={14} strokeWidth={2.8} />
              </span>
              <span className="text-[13px] text-body">{line}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
