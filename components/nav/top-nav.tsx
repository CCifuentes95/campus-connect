import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/nav/theme-toggle";
import type { Role } from "@/lib/roles";

type NavLink = { label: string; href: string };

const NAV: Record<Role, { subtitle: string; links: NavLink[] }> = {
  student: {
    subtitle: "International Business University",
    links: [
      { label: "Dashboard", href: "/" },
      { label: "Requests", href: "/requests" },
      { label: "Appointments", href: "/appointments" },
    ],
  },
  advisor: {
    subtitle: "Staff · Support workspace",
    links: [
      { label: "Triage board", href: "/staff/triage" },
      { label: "Appointments", href: "/staff/appointments" },
    ],
  },
  admin: {
    subtitle: "Admin · Program office",
    links: [
      // Role management (Users) is deferred — custom claims need the Admin SDK / a callable
      // Cloud Function, neither available on Vercel in this MVP (ADR-0004). Use the setRole CLI.
      { label: "Reports", href: "/admin/reports" },
      { label: "Triage board", href: "/staff/triage" },
    ],
  },
};

export function TopNav({
  role,
  displayName,
  initials: initialsProp,
  activePath,
  hasUnread,
}: {
  role: Role;
  displayName?: string | null;
  initials?: string;
  activePath?: string;
  /** Gold-dot unread indicator on the notification bell. Omit (undefined) to hide the bell
   * entirely — staff/admin don't get notifications yet (US-07 hasn't shipped). */
  hasUnread?: boolean;
}) {
  const { subtitle, links } = NAV[role];
  // Prefer the precomputed profile initials; otherwise derive from the display name.
  const initials =
    initialsProp ??
    (displayName ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0]!)
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <header className="sticky top-0 z-20 bg-nav text-white">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-7 px-6">
        <div className="flex flex-shrink-0 items-center gap-3">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[9px] bg-gold text-[18px] font-extrabold text-navy">
            IB
          </div>
          <div className="leading-tight">
            <div className="text-[16px] font-bold" translate="no">CampusConnect</div>
            <div className="text-[11px] font-medium text-nav-muted">{subtitle}</div>
          </div>
        </div>

        <nav className="flex min-w-0 flex-1 gap-1.5">
          {links.map((link) => {
            const active = activePath === link.href;
            return (
              <Link
                key={`${link.label}-${link.href}`}
                href={link.href}
                className={`rounded-lg px-3.5 py-2 text-[14px] font-medium ${
                  active
                    ? "bg-white/10 font-semibold text-white"
                    : "text-nav-muted hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-shrink-0 items-center gap-3.5">
          {hasUnread !== undefined ? (
            <Link
              href="/notifications"
              aria-label={hasUnread ? "Notifications (unread)" : "Notifications"}
              className="relative flex h-[38px] w-[38px] items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
            >
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {hasUnread ? (
                <span
                  aria-hidden="true"
                  className="absolute right-2 top-[7px] h-2 w-2 rounded-full border-2 border-nav bg-gold"
                />
              ) : null}
            </Link>
          ) : null}
          {displayName ? (
            <div className="flex items-center gap-2.5 border-l border-nav-muted/25 pl-3.5">
              <div className="whitespace-nowrap text-right leading-tight">
                <div className="text-[14px] font-semibold">{displayName}</div>
                <div className="text-[11px] capitalize text-nav-muted">{role}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gold bg-teal-solid text-[15px] font-bold text-white">
                {initials}
              </div>
            </div>
          ) : null}
          <ThemeToggle />
          <SignOutButton className="rounded-lg bg-white/10 px-3 py-2 text-[13px] font-semibold text-white hover:bg-white/20" />
        </div>
      </div>
    </header>
  );
}
