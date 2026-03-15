import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { OrgResolver } from "./org-resolver";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.session.activeOrganizationId) {
    return <OrgResolver />;
  }

  return <>{children}</>;
}
