import {
  IconAlertTriangle,
  IconBan,
  IconCircleCheck,
  IconClock,
  IconLoader2,
  IconMinus,
  IconPlayerSkipForward,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/**
 * What happened, in one word and one colour.
 *
 * **`waiting` is not a shade of success and not a shade of failure**, and this
 * is the whole reason the component exists rather than a two-tone
 * pass/fail pill. A durable pause is the headline feature of the engine: a run
 * can sit in `waiting` for three days, entirely healthy, and colouring it green
 * says it finished while colouring it amber says something is wrong. It gets
 * its own treatment and its own word.
 *
 * `cancelled` is likewise deliberately neutral rather than red. A `logic.stop`
 * set to "Stopped early" — "this customer already paid, stop chasing them" — is
 * the automation working exactly as written, and the engine goes out of its way
 * to keep it out of the failure notification for that reason. A red badge here
 * would put it straight back in front of the user as a problem.
 */

const RUN_STYLES = {
  running: {
    label: "Running",
    icon: IconLoader2,
    className: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    spin: true,
  },
  waiting: {
    label: "Waiting",
    icon: IconClock,
    className:
      "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  completed: {
    label: "Finished",
    icon: IconCircleCheck,
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  failed: {
    label: "Failed",
    icon: IconAlertTriangle,
    className: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  },
  cancelled: {
    label: "Stopped",
    icon: IconBan,
    className: "border-border bg-muted text-muted-foreground",
  },
} as const;

const STEP_STYLES = {
  running: RUN_STYLES.running,
  completed: RUN_STYLES.completed,
  failed: RUN_STYLES.failed,
  waiting: RUN_STYLES.waiting,
  skipped: {
    label: "Skipped",
    icon: IconPlayerSkipForward,
    className: "border-border bg-muted text-muted-foreground",
  },
} as const;

const UNKNOWN = {
  label: "Unknown",
  icon: IconMinus,
  className: "border-border bg-muted text-muted-foreground",
} as const;

interface Props {
  status: string;
  /** A step's states differ from a run's — `skipped` exists only on a step. */
  kind?: "run" | "step";
  className?: string;
}

export function RunStatusBadge({ status, kind = "run", className }: Props) {
  const table: Record<string, (typeof RUN_STYLES)[keyof typeof RUN_STYLES] | typeof UNKNOWN> =
    kind === "step" ? STEP_STYLES : RUN_STYLES;
  const style = table[status] ?? UNKNOWN;
  const Icon = style.icon;
  const spin = "spin" in style && style.spin;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5",
        "text-xs font-medium font-body",
        style.className,
        className,
      )}
    >
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", spin && "motion-safe:animate-spin")}
      />
      {style.label}
    </span>
  );
}
