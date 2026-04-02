"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { IconSun, IconMoon, IconDeviceDesktop } from "@tabler/icons-react";
import {
  ThemeToggler,
  type ThemeSelection,
  type Resolved,
} from "@/components/animate-ui/primitives/effects/theme-toggler";
import { cn } from "@/lib/utils";

function getIcon(effective: ThemeSelection, resolved: Resolved, modes: ThemeSelection[]) {
  const theme = modes.includes("system") ? effective : resolved;
  if (theme === "system") return <IconDeviceDesktop size={18} stroke={1.5} />;
  if (theme === "dark") return <IconMoon size={18} stroke={1.5} />;
  return <IconSun size={18} stroke={1.5} />;
}

function getNextTheme(effective: ThemeSelection, modes: ThemeSelection[]): ThemeSelection {
  const i = modes.indexOf(effective);
  if (i === -1) return modes[0];
  return modes[(i + 1) % modes.length];
}

export function ThemeToggle({
  className = "",
  modes = ["light", "dark"] as ThemeSelection[],
}: {
  className?: string;
  modes?: ThemeSelection[];
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={cn("h-9 w-9", className)} />;
  }

  return (
    <ThemeToggler
      theme={(theme ?? "light") as ThemeSelection}
      resolvedTheme={(resolvedTheme ?? "light") as Resolved}
      setTheme={setTheme}
      direction="ttb"
    >
      {({ effective, resolved, toggleTheme }) => (
        <button
          type="button"
          onClick={() => toggleTheme(getNextTheme(effective, modes))}
          className={cn(
            "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-accent",
            className,
          )}
          aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
        >
          {getIcon(effective, resolved, modes)}
        </button>
      )}
    </ThemeToggler>
  );
}
