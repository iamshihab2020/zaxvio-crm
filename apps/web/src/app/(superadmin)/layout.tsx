import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { SuperadminSidebarProvider } from "@/components/superadmin/superadmin-sidebar-provider";
import { SuperadminSidebar } from "@/components/superadmin/superadmin-sidebar";
import { SuperadminNavbar } from "@/components/superadmin/superadmin-navbar";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <SuperadminSidebarProvider>
      <div className="flex min-h-screen">
        <SuperadminSidebar />
        <SuperadminShell>
          <SuperadminNavbar />
          <main className="pt-14">{children}</main>
        </SuperadminShell>
      </div>
    </SuperadminSidebarProvider>
  );
}
