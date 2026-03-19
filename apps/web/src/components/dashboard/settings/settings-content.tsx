"use client";

import { usePathname } from "next/navigation";

export function SettingsContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className="mt-6 animate-settings-enter"
    >
      {children}
    </div>
  );
}
