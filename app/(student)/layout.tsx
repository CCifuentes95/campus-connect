import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/firebase/session";
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

  return (
    <>
      <TopNav role="student" displayName={user.email} />
      <main className="flex-1">{children}</main>
    </>
  );
}
