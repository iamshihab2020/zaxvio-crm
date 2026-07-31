import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "@/lib/auth-server";
import { OrgResolver } from "./org-resolver";
import { SidebarProvider } from "@/components/dashboard/sidebar-provider";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Navbar } from "@/components/dashboard/navbar";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ImpersonationBar } from "@/components/dashboard/impersonation-bar";
import { ImpersonationRequestListener } from "@/components/dashboard/impersonation-request-listener";
import { ImpersonationActiveIndicator } from "@/components/dashboard/impersonation-active-indicator";
import { HelpChatbot } from "@/components/dashboard/chatbot/help-chatbot";
import { PageContent } from "@/components/dashboard/page-content";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  // Check for impersonation — admin impersonating a tenant should stay in dashboard
  const cookieStore = await cookies();
  const impersonationId = cookieStore.get("x-impersonation-id")?.value;
  const isImpersonating =
    session.user.role === "admin" && !!impersonationId;

  // Admins should never land in the tenant dashboard (unless impersonating)
  if (session.user.role === "admin" && !isImpersonating) {
    redirect("/superadmin/dashboard");
  }

  if (!session.session.activeOrganizationId && !isImpersonating) {
    return <OrgResolver />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <DashboardShell>
          {isImpersonating && <ImpersonationBar />}
          {!isImpersonating && (
            <>
              <ImpersonationRequestListener />
              <ImpersonationActiveIndicator />
            </>
          )}
          {/* The global background-fetch progress bar was removed here. It sat
              at the top of the viewport and animated left-to-right whenever any
              query was in flight for longer than its threshold. On this stack
              every request crosses browser -> Vercel server action -> Render ->
              Neon, measured at 300-960ms even for endpoints that touch no
              database, so it fired on essentially every navigation and filter
              change and read as a permanent distraction rather than as
              feedback. Individual pages already show their own skeletons and
              disabled states, which is where loading belongs.
              To bring it back, restore components/dashboard/global-fetch-indicator.tsx
              from git history — but it needs a threshold above the real p95
              latency, not below it. */}
          <Navbar />
          <PageContent className={isImpersonating ? "pt-24" : "pt-14"}>
            {children}
          </PageContent>
        </DashboardShell>
        <HelpChatbot />
      </div>
    </SidebarProvider>
  );
}
