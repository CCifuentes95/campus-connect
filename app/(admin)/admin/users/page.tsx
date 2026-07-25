import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UsersRoster } from "@/components/admin/users-roster";
import { getAdminUsers } from "@/lib/data/admin-users";
import { getSessionUser } from "@/lib/firebase/session";

export const metadata: Metadata = {
  title: "People & access · CampusConnect",
  description: "Create, edit and remove CampusConnect accounts.",
};

// Admin-only: the (admin) route-group layout already redirects non-admins. The session read
// here is for the current uid (used to block self-delete in the UI).
export default async function AdminUsersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { items, error } = await getAdminUsers();

  return <UsersRoster users={items} error={error} currentUid={user.uid} />;
}
