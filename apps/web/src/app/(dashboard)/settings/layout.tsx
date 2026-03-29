import { SettingsNav } from "@/components/dashboard/settings/settings-nav";
import { SettingsContent } from "@/components/dashboard/settings/settings-content";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="p-6">
      <SettingsNav />
      <SettingsContent>{children}</SettingsContent>
    </section>
  );
}
