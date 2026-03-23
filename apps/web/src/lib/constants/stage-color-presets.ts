export interface StageColorSet {
  dot: string;
  bg: string;
  text: string;
  border: string;
}

export const STAGE_COLOR_PRESETS: Record<string, StageColorSet> = {
  blue: {
    dot: "bg-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  brand: {
    dot: "bg-brand",
    bg: "bg-brand-light/30",
    text: "text-brand",
    border: "border-brand/40",
  },
  green: {
    dot: "bg-green-500",
    bg: "bg-green-50 dark:bg-green-950/40",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-200 dark:border-green-800",
  },
  red: {
    dot: "bg-red-500",
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
  },
  purple: {
    dot: "bg-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
  },
  amber: {
    dot: "bg-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  gray: {
    dot: "bg-muted-foreground",
    bg: "bg-muted/30",
    text: "text-muted-foreground",
    border: "border-border",
  },
  teal: {
    dot: "bg-teal-500",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-800",
  },
};

export const STAGE_COLOR_KEYS = Object.keys(STAGE_COLOR_PRESETS);

export function getStageColors(colorKey: string): StageColorSet {
  return STAGE_COLOR_PRESETS[colorKey] ?? STAGE_COLOR_PRESETS.gray;
}
