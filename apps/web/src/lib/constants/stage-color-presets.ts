export interface StageColorSet {
  dot: string;
  bg: string;
  text: string;
  border: string;
  borderTop: string;
  ring: string;
  /** Raw hex/hsl value for inline `style.backgroundColor` (charts, SVG, etc.). */
  hex: string;
}

export const STAGE_COLOR_PRESETS: Record<string, StageColorSet> = {
  blue: {
    dot: "bg-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    borderTop: "border-t-blue-500",
    ring: "ring-blue-300/40 dark:ring-blue-600/40",
    hex: "#3b82f6",
  },
  brand: {
    dot: "bg-brand",
    bg: "bg-brand-light/40 dark:bg-brand/15",
    text: "text-brand dark:text-brand",
    border: "border-brand/30 dark:border-brand/40",
    borderTop: "border-t-brand",
    ring: "ring-brand/30 dark:ring-brand/30",
    hex: "hsl(var(--brand))",
  },
  green: {
    dot: "bg-green-500",
    bg: "bg-green-50 dark:bg-green-950/40",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-200 dark:border-green-800",
    borderTop: "border-t-green-500",
    ring: "ring-green-300/40 dark:ring-green-600/40",
    hex: "#22c55e",
  },
  red: {
    dot: "bg-red-500",
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
    borderTop: "border-t-red-500",
    ring: "ring-red-300/40 dark:ring-red-600/40",
    hex: "#ef4444",
  },
  purple: {
    dot: "bg-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
    borderTop: "border-t-purple-500",
    ring: "ring-purple-300/40 dark:ring-purple-600/40",
    hex: "#a855f7",
  },
  amber: {
    dot: "bg-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    borderTop: "border-t-amber-500",
    ring: "ring-amber-300/40 dark:ring-amber-600/40",
    hex: "#f59e0b",
  },
  gray: {
    dot: "bg-muted-foreground",
    bg: "bg-muted/30",
    text: "text-muted-foreground",
    border: "border-border",
    borderTop: "border-t-muted-foreground",
    ring: "ring-muted-foreground/20",
    hex: "#94a3b8",
  },
  teal: {
    dot: "bg-teal-500",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-800",
    borderTop: "border-t-teal-500",
    ring: "ring-teal-300/40 dark:ring-teal-600/40",
    hex: "#14b8a6",
  },
};

export const STAGE_COLOR_KEYS = Object.keys(STAGE_COLOR_PRESETS);

export function getStageColors(colorKey: string): StageColorSet {
  return STAGE_COLOR_PRESETS[colorKey] ?? STAGE_COLOR_PRESETS.gray;
}
