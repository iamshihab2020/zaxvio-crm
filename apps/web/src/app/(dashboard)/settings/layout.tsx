import { getServerOrgRole } from "@/lib/auth-server";
import { SettingsNav } from "@/components/dashboard/settings/settings-nav";
import { SettingsContent } from "@/components/dashboard/settings/settings-content";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolved here rather than inside SettingsNav so the nav is complete in the
  // server-rendered HTML. Two of its items are role-gated; fetching the role
  // from the client meant they were always absent on first paint and shoved the
  // groups below them down when they arrived.
  const orgRole = await getServerOrgRole();

  return (
    <div className="md:flex min-h-[calc(100vh-3.5rem)]">
      <SettingsNav orgRole={orgRole} />
      <div className="flex-1 min-w-0">
        <SettingsContent>{children}</SettingsContent>
      </div>
    </div>
  );
}
