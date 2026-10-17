import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WidgetHeaderProps {
  title: string;
  /** Sits beside the title, e.g. a `WidgetWindowBadge`. */
  badge?: ReactNode;
  /** Pushed to the right: a `WidgetLink`, a select, a count. */
  action?: ReactNode;
  className?: string;
}

/**
 * The one header row every dashboard widget shares: title and badge on the
 * left, the widget's own control on the right.
 *
 * Each widget used to build this row by hand, and the copies had drifted: some
 * titles were `whitespace-nowrap`, some actions were, and none of them wrapped,
 * so on a phone the "View schedule →" link pushed the card wider than the
 * screen. This one wraps, and the title is an `h2` because the navbar holds the
 * page's only `h1` and the widgets are that page's sections.
 */
export function WidgetHeader({ title, badge, action, className }: WidgetHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate font-heading text-sm font-semibold text-foreground">
          {title}
        </h2>
        {badge}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * A widget's "go to the full page" link. 40px tall on phones, where it is a
 * thumb target; back to its text height from `sm`, where it is a pointer one.
 */
export function WidgetLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center whitespace-nowrap rounded-sm text-xs font-body text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
    >
      {children}
    </Link>
  );
}
