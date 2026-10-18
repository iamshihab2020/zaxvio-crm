"use client";

import type { ComponentProps } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

/**
 * Sonner, told which theme is active.
 *
 * The root layout rendered sonner's `Toaster` directly, and that component is
 * light unless given a `theme`, so in dark mode every toast was a white card on
 * a near-black page. It needs the resolved theme from next-themes, which only a
 * client component can read, hence this wrapper (the shadcn pattern).
 */
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return <Sonner theme={resolvedTheme === "dark" ? "dark" : "light"} {...props} />;
}
