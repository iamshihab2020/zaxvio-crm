import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { OrgResolver } from "./org-resolver";
import { SidebarProvider } from "@/components/dashboard/sidebar-provider";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Navbar } from "@/components/dashboard/navbar";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

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
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <DashboardShell>
          <Navbar />
          <main className="pt-14">{children}</main>
        </DashboardShell>
      </div>
    </SidebarProvider>
  );
}
