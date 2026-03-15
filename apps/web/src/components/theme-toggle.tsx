"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "@tabler/icons-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={`h-9 w-9 ${className}`} />;
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent ${className}`}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      {resolvedTheme === "dark" ? (
        <IconSun size={18} stroke={1.5} />
      ) : (
        <IconMoon size={18} stroke={1.5} />
      )}
    </button>
  );
}
