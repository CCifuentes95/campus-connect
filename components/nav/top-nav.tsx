import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
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
      { label: "My requests", href: "/staff/requests" },
      { label: "Appointments", href: "/appointments" },
      { label: "Reports", href: "/admin/reports" },
    ],
  },
  admin: {
    subtitle: "Admin · Program office",
    links: [
      { label: "Dashboard", href: "/admin/reports" },
      { label: "Triage board", href: "/staff/triage" },
      { label: "Reports", href: "/admin/reports" },
      { label: "Users", href: "/admin/users" },
    ],
  },
};

export function TopNav({
  role,
  displayName,
  activePath,
}: {
  role: Role;
  displayName?: string | null;
  activePath?: string;
}) {
  const { subtitle, links } = NAV[role];
  const initials = (displayName ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 bg-[#0d2c49] text-white">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-7 px-6">
        <div className="flex flex-shrink-0 items-center gap-3">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[9px] bg-[#d7a524] text-[18px] font-extrabold text-[#0d2c49]">
            IB
          </div>
          <div className="leading-tight">
            <div className="text-[16px] font-bold">CampusConnect</div>
            <div className="text-[11px] font-medium text-[#b6c6d5]">{subtitle}</div>
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
                    : "text-[#b6c6d5] hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-shrink-0 items-center gap-3.5">
          {displayName ? (
            <div className="flex items-center gap-2.5 border-l border-[#b6c6d5]/25 pl-3.5">
              <div className="whitespace-nowrap text-right leading-tight">
                <div className="text-[14px] font-semibold">{displayName}</div>
                <div className="text-[11px] capitalize text-[#b6c6d5]">{role}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#d7a524] bg-[#064948] text-[15px] font-bold text-white">
                {initials}
              </div>
            </div>
          ) : null}
          <SignOutButton className="rounded-lg bg-white/10 px-3 py-2 text-[13px] font-semibold text-white hover:bg-white/20" />
        </div>
      </div>
    </header>
  );
}
