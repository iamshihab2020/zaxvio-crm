import { SettingsNav } from "@/components/dashboard/settings/settings-nav";
import { SettingsContent } from "@/components/dashboard/settings/settings-content";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="p-6" aria-labelledby="settings-heading">
      <h1
        id="settings-heading"
        className="font-heading text-2xl font-bold text-foreground"
      >
        Settings
      </h1>
      <SettingsNav />
      <SettingsContent>{children}</SettingsContent>
    </section>
  );
}
