import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { OrgResolver } from "./org-resolver";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Navbar } from "@/components/dashboard/navbar";

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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 pl-60">
        <Navbar />
        <main className="pt-14">{children}</main>
      </div>
    </div>
  );
}
