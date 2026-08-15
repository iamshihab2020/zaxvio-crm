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
import { PageActionsProvider } from "@/components/dashboard/page-actions";
import { RunningTimerBar } from "@/components/dashboard/reusable/running-timer-bar";

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
          {/* Wraps both, because pages portal their action buttons up into the
              navbar — the two are siblings, so a context is the only way for
              one to reach the other. */}
          <PageActionsProvider>
            <Navbar />
            <PageContent className={isImpersonating ? "pt-24" : "pt-14"}>
              {/* Inside the scroll flow so it can pin, and above the page's own
                  content so a running timer is the first thing on screen. It
                  renders nothing at all when no timer is running, which is
                  almost always — so every other page pays one cached query and
                  no layout. */}
              <RunningTimerBar
                offsetClass={isImpersonating ? "top-24" : "top-14"}
              />
              {children}
            </PageContent>
          </PageActionsProvider>
        </DashboardShell>
        <HelpChatbot />
      </div>
    </SidebarProvider>
  );
}
