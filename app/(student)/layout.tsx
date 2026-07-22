import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/firebase/session";
import { getStudentProfile } from "@/lib/data/student-dashboard";
import { homeForRole } from "@/lib/roles";
import { TopNav } from "@/components/nav/top-nav";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect(homeForRole(user.role));

  // Real profile identity for the nav (falls back to the email if the profile is missing).
  // React-cached, so the dashboard page reuses this read.
  const profile = await getStudentProfile();

  return (
    <>
      <TopNav
        role="student"
        displayName={profile?.displayName ?? profile?.email ?? user.email}
        initials={profile?.initials ?? undefined}
      />
      <main className="flex-1">{children}</main>
    </>
  );
}
