import { SettingsNav } from "@/components/dashboard/settings/settings-nav";

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
      <div className="mt-6">{children}</div>
    </section>
  );
}
