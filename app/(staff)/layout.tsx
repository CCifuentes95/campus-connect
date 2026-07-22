import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/firebase/session";
import { homeForRole, isStaff } from "@/lib/roles";
import { TopNav } from "@/components/nav/top-nav";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isStaff(user.role)) redirect(homeForRole(user.role));

  // advisor + admin both use the staff workspace; admin keeps its own nav variant.
  return (
    <>
      <TopNav role={user.role === "admin" ? "admin" : "advisor"} displayName={user.email} />
      <main id="main" tabIndex={-1} className="flex-1 scroll-mt-4 outline-none">
        {children}
      </main>
    </>
  );
}
