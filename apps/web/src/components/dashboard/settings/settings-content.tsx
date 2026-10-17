"use client";

import { usePathname } from "next/navigation";

export function SettingsContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className="p-4 sm:p-6 animate-settings-enter"
    >
      {children}
    </div>
  );
}
