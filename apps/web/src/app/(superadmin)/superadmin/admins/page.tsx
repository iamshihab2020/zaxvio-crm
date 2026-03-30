import { getAdminUsers } from "@/actions/admin";
import { getServerSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { AdminsPageClient } from "./admins-page-client";

export default async function SuperAdminAdminsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const result = await getAdminUsers();

  return (
    <AdminsPageClient
      initialData={result.data ?? []}
      currentUserId={session.user.id}
    />
  );
}
