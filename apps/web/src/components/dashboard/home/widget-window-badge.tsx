import { cn } from "@/lib/utils";

interface WidgetWindowBadgeProps {
  /** The window this widget actually covers, e.g. "Next 7 days", "All open". */
  label: string;
  className?: string;
}

/**
 * Marks a widget whose data does NOT follow the dashboard date picker.
 *
 * Six of the eleven dashboard widgets are fixed-window (agenda, retention, aging,
 * overdue, activity) and nothing on screen said so — a user who picked "last
 * quarter" would reasonably read the agenda as last quarter's agenda. Stating the
 * real window in the card header removes that whole class of misreading.
 */
export function WidgetWindowBadge({ label, className }: WidgetWindowBadgeProps) {
  return (
    <span
      title={`This widget always shows: ${label}. It is not affected by the date range picker.`}
      className={cn(
        "whitespace-nowrap rounded-full border border-border/60 bg-muted/40 px-2 py-0.5",
        "text-[10px] font-body uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
