import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/firebase/session";
import { homeForRole, isAdmin } from "@/lib/roles";
import { TopNav } from "@/components/nav/top-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect(homeForRole(user.role));

  return (
    <>
      <TopNav role="admin" displayName={user.email} />
      <main className="flex-1">{children}</main>
    </>
  );
}
