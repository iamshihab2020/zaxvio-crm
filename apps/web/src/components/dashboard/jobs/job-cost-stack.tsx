"use client";

import type { JobCostSummary } from "@hvac-saas/types";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

/**
 * Where a job's money went, as one bar.
 *
 * The bar is scaled to whichever is larger, what was billed or what it cost, and
 * a rule is drawn at the billed figure. So a profitable job fills part of the
 * bar and leaves margin; a job that ran over pushes past the rule and the
 * overrun is visible as length rather than as a minus sign you have to read.
 *
 * The part that matters: **when the cost side is incomplete, the margin segment
 * is hatched rather than filled.** That remainder is not proven profit — it is
 * profit *or* a cost nobody has entered yet, and those are different claims. A
 * solid green bar over a half-costed job is the single most misleading thing
 * this feature could draw, so it is the one thing it will not draw.
 */

interface JobCostStackProps {
  summary: JobCostSummary;
}

/** Repeating diagonal rule — reads as "not filled in", not as a fifth colour. */
const HATCH: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, hsl(var(--muted-foreground) / 0.28) 0 2px, transparent 2px 7px)",
};

interface Segment {
  key: string;
  label: string;
  amount: number;
  className: string;
  style?: React.CSSProperties;
}

export function JobCostStack({ summary }: JobCostStackProps) {
  const revenue = Number(summary.revenue);
  const cost = Number(summary.totalCost);
  const margin = Number(summary.margin);
  const complete = summary.coverage.complete;

  // Scale to the longer of the two sides so an overrun has somewhere to go.
  const scale = Math.max(revenue, cost, 1);
  const pct = (value: number) => `${Math.max(0, (value / scale) * 100)}%`;

  const costSegments: Segment[] = [
    {
      key: "lineItemCost",
      label: "Parts & materials",
      amount: Number(summary.lineItemCost),
      className: "bg-brand",
    },
    {
      key: "laborCost",
      label: "Labour",
      amount: Number(summary.laborCost),
      className: "bg-brand/55",
    },
    {
      key: "expenseCost",
      label: "Expenses",
      amount: Number(summary.expenseCost),
      className: "bg-brand/30",
    },
  ].filter((s) => s.amount > 0);

  const remainder: Segment | null =
    margin > 0
      ? {
          key: "margin",
          label: complete ? "Margin" : "Margin, not yet proven",
          amount: margin,
          className: complete
            ? "bg-green-500/70 dark:bg-green-500/60"
            : "bg-muted",
          ...(complete ? {} : { style: HATCH }),
        }
      : margin < 0
        ? {
            key: "loss",
            label: "Over budget",
            amount: -margin,
            className: "bg-red-500/70 dark:bg-red-500/60",
          }
        : null;

  const segments = remainder ? [...costSegments, remainder] : costSegments;

  const summaryText = complete
    ? `${formatMoney(summary.revenue)} billed, ${formatMoney(summary.totalCost)} spent, ${formatMoney(summary.margin)} margin`
    : `${formatMoney(summary.revenue)} billed and at least ${formatMoney(summary.totalCost)} spent. Some costs are not entered yet.`;

  return (
    <div className="space-y-2.5">
      <div
        className="relative flex h-9 w-full overflow-hidden rounded-md border border-border bg-muted/40"
        role="img"
        aria-label={summaryText}
      >
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={cn(
              "h-full border-r border-background/40 last:border-r-0",
              "motion-safe:transition-[width] motion-safe:duration-500",
              seg.className,
            )}
            style={{ width: pct(seg.amount), ...seg.style }}
            title={`${seg.label} — ${formatMoney(seg.amount)}`}
          />
        ))}

        {/* What the customer was actually charged. With the bar scaled to the
            larger side, this is the only fixed reference on it — without it an
            overrun and a healthy job draw the same full-width bar. */}
        {revenue > 0 && cost > revenue && (
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-foreground/70"
            style={{ left: pct(revenue) }}
            aria-hidden
          />
        )}
      </div>

      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5">
            <span
              className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", seg.className)}
              style={seg.style}
              aria-hidden
            />
            <dt className="font-body text-xs text-muted-foreground">
              {seg.label}
            </dt>
            <dd className="tnum font-mono text-xs font-medium text-foreground">
              {formatMoney(seg.amount)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
