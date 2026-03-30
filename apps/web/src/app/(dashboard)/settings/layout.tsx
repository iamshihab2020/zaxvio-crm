import { SettingsNav } from "@/components/dashboard/settings/settings-nav";
import { SettingsContent } from "@/components/dashboard/settings/settings-content";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="md:flex min-h-[calc(100vh-3.5rem)]">
      <SettingsNav />
      <div className="flex-1 min-w-0">
        <SettingsContent>{children}</SettingsContent>
      </div>
    </div>
  );
}
