"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type {
  DashboardCategoryCount,
  DashboardPipelineItem,
  Pipeline,
} from "@hvac-saas/types";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/reusable/animated-number";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePipelines } from "@/hooks/queries/use-pipelines";
import { useDashboardPipeline } from "@/hooks/queries";
import type { JobPriority } from "@/lib/constants/job-options";
import {
  NEUTRAL_COLOR,
  pipelineRingOrder,
  pipelineStageColors,
  rampColor,
  type RampStep,
} from "@/lib/constants/chart-palette";
import { useStagger } from "@/hooks/use-stagger";
import { cn } from "@/lib/utils";
import { chartAnimation } from "./chart-motion";
import { WidgetHeader } from "./widget-header";

interface JobsManagementPanelProps {
  /** Default-pipeline distribution that came with the main dashboard payload. */
  defaultPipeline: DashboardPipelineItem[];
  priorityBreakdown: DashboardCategoryCount[];
  serviceBreakdown: DashboardCategoryCount[];
  pipelineId: string | null;
  onPipelineChange: (id: string | null) => void;
}

type Segment = "status" | "priority" | "service";

const SEGMENT_OPTIONS: { value: Segment; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "service", label: "Service" },
];

/** The folded tail of the service segment. Not a service type, so it links unfiltered. */
const OTHER_BUCKET = "__other";

/**
 * Priority is a scale, so it climbs the brand ramp: standard is the quiet end,
 * emergency the strong one. It was blue, amber and red, which put a second and
 * third accent on a card about volume. The word in the list beside the ring is
 * what says "emergency"; the board's red pill still does on the job itself.
 */
const PRIORITY_COLORS: Record<JobPriority, string> = {
  standard: rampColor(1),
  urgent: rampColor(3),
  emergency: rampColor(5),
};

/**
 * Service types have no order, so they take ramp steps by rank, ordered so that
 * neighbouring slices (neighbouring ranks) are always two or more steps apart.
 * Validated in that order with the stone "Other" closing the ring.
 */
const SERVICE_STEPS: readonly RampStep[] = [3, 1, 5, 2, 4];

interface Bucket {
  key: string;
  label: string;
  count: number;
  color: string;
  /** Where the ring draws this bucket, when that differs from the list's order. */
  ring?: number;
}

export function JobsManagementPanel({
  defaultPipeline,
  priorityBreakdown,
  serviceBreakdown,
  pipelineId,
  onPipelineChange,
}: JobsManagementPanelProps) {
  const [segment, setSegment] = useState<Segment>("status");
  const { data: pipelinesRes } = usePipelines();
  const pipelines = (pipelinesRes ?? []) as Pipeline[];

  // Only fetch when a non-default pipeline is selected — the default already
  // arrived with the dashboard payload, so the common case costs nothing.
  const { data: pipelineRes, isFetching: isPipelineFetching } =
    useDashboardPipeline(pipelineId);
  const pipeline = pipelineId ? (pipelineRes?.data ?? []) : defaultPipeline;

  const buckets: Bucket[] = useMemo(() => {
    if (segment === "status") {
      // The stages climb the brand ramp in board order, the way the work does
      // (`pipelineStageColors`). The stored stage colour is a preset name for
      // the board's columns, and several presets are green, red or amber.
      // The list keeps board order; the ring may not (`pipelineRingOrder`).
      const names = pipeline.map((p) => p.stageName);
      const colors = pipelineStageColors(names);
      const ringOrder = pipelineRingOrder(names);
      return pipeline.map((p, i) => ({
        key: p.stageName,
        label: p.stageLabel,
        count: p.count,
        color: colors[i] ?? NEUTRAL_COLOR,
        ring: ringOrder.indexOf(i),
      }));
    }
    if (segment === "priority") {
      return priorityBreakdown.map((p) => ({
        key: p.key,
        label: p.label,
        count: p.count,
        color:
          p.key in PRIORITY_COLORS
            ? PRIORITY_COLORS[p.key as JobPriority]
            : NEUTRAL_COLOR,
      }));
    }
    // Service types have no stored colour, so they take ramp steps in count
    // order (`SERVICE_STEPS`), and every pair of touching slices is the pairing
    // that was validated. Keying the colour to the type would hold steadier
    // across date ranges, but seven types against five steps would put
    // unchecked pairs side by side. The tail folds into one stone "Other", and
    // so does the literal "other" type.
    const ranked = [...serviceBreakdown]
      .filter((s) => s.key !== "other")
      .sort((a, b) => b.count - a.count);
    const named: Bucket[] = ranked
      .slice(0, SERVICE_STEPS.length)
      .map((s, i) => ({
        key: s.key,
        label: s.label,
        count: s.count,
        color: rampColor(SERVICE_STEPS[i] ?? 3),
      }));
    const tail = [
      ...ranked.slice(SERVICE_STEPS.length),
      ...serviceBreakdown.filter((s) => s.key === "other"),
    ];
    if (tail.length === 0) return named;
    if (tail.length === 1) return [...named, { ...tail[0]!, color: NEUTRAL_COLOR }];
    return [
      ...named,
      {
        key: OTHER_BUCKET,
        label: `Other (${tail.length})`,
        count: tail.reduce((sum, s) => sum + s.count, 0),
        color: NEUTRAL_COLOR,
      },
    ];
  }, [segment, pipeline, priorityBreakdown, serviceBreakdown]);

  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  // Resolve the currently-displayed pipeline id for the selector.
  // When `pipelineId` is null, backend returned the default — find it so the picker shows it.
  const defaultPipelineId =
    pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? "";
  const selectValue = pipelineId ?? defaultPipelineId;

  // The legend re-lays itself when the view changes (a tab, another pipeline),
  // not when a refetch hands back the same buckets. The key is the segment and
  // the buckets it holds rather than the pipeline id: choosing a pipeline keeps
  // the previous one's data on screen (`placeholderData`) until the new data
  // lands, and the id changes before the rows do. The bucket keys change with
  // the rows, so the sequence plays when they are actually replaced.
  const legendRef = useRef<HTMLUListElement>(null);
  useStagger(
    legendRef,
    buckets.length > 0 ? `${segment}:${buckets.map((b) => b.key).join("|")}` : null,
  );

  return (
    <Card data-widget="jobsManagement" className="flex h-full flex-col p-4 sm:p-6">
      <WidgetHeader
        title="Jobs Management"
        action={
          <>
            {pipelines.length > 0 && (
              <Select
                value={selectValue}
                onValueChange={(v) => onPipelineChange(v || null)}
              >
                <SelectTrigger className="h-9 w-auto max-w-[160px] px-3 text-xs sm:h-7">
                  <SelectValue placeholder="Pipeline" />
                </SelectTrigger>
                <SelectContent align="end">
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.label ?? p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span
              className={cn(
                "whitespace-nowrap text-xs font-body text-muted-foreground transition-opacity",
                isPipelineFetching && "opacity-50",
              )}
            >
              <AnimatedNumber value={total} format={String} className="font-mono" />{" "}
              total
            </span>
          </>
        }
      />

      <div role="group" aria-label="Group jobs by" className="mt-3">
        <StatusFilterTabs
          options={SEGMENT_OPTIONS}
          value={segment}
          onChange={(v) => {
            const next = SEGMENT_OPTIONS.find((o) => o.value === v);
            if (next) setSegment(next.value);
          }}
          fullWidthOnMobile
        />
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {/*
          A donut with a legend, not a 2x2 grid of count tiles.

          The tiles were the wrong chart for the question. This data is a
          composition — how the 19 jobs split across four states — and four
          separate numbers make the reader do the division themselves. A ring
          shows the split at a glance and keeps the total in the middle, and
          because it is one fixed-size object plus a list, it fills the card
          at any height instead of leaving a hole under a short grid.
        */}
        {buckets.length === 0 ? (
          <div className="motion-appear rounded-md border border-dashed border-border bg-muted/10 p-4 text-center text-xs font-body text-muted-foreground sm:p-6">
            No data in current range.
          </div>
        ) : (
          /* Wraps instead of switching at `sm`: this card is full width on a
             phone and a tablet but only ~280px inside once the dashboard goes
             two-up, and beside a 132px ring that leaves a legend row about 17px
             for its label. The legend needs ~190px, so it sits beside the ring
             when there is room and drops below it when there is not. */
          <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-6">
            <BucketDonut buckets={buckets} total={total} />

            <ul ref={legendRef} className="min-w-0 grow basis-[12rem] space-y-0.5">
              {buckets.map((b) => {
                const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
                return (
                  <li key={b.key}>
                    <Link
                      href={bucketHref(segment, b.key, pipelineId)}
                      aria-label={`${b.label}: ${b.count} jobs, ${pct}% of ${total}`}
                      className="flex min-h-10 items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-brand/5 sm:min-h-0"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: b.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-body text-muted-foreground">
                        {b.label}
                      </span>
                      <span className="tnum shrink-0 font-mono text-sm font-medium text-foreground">
                        {b.count}
                      </span>
                      <span className="tnum w-9 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                        {pct}%
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Deep-link a segment bucket into the Jobs page.
 *
 * Param names must match what `jobs-page-client.tsx` reads: `priority`,
 * `serviceType`, and `pipeline` (not `pipelineId`). The Jobs page has no status
 * filter — status *is* the board's columns — so a status bucket just opens the
 * right pipeline rather than promising a filter that would silently do nothing.
 */
function bucketHref(
  segment: Segment,
  key: string,
  pipelineId: string | null,
): string {
  const params = new URLSearchParams();
  if (segment === "priority") params.set("priority", key);
  if (segment === "service" && key !== OTHER_BUCKET) params.set("serviceType", key);
  if (pipelineId) params.set("pipeline", pipelineId);
  const qs = params.toString();
  return qs ? `/jobs?${qs}` : "/jobs";
}

/**
 * Composition ring for the active segment.
 *
 * Replaces the stacked `SegmentBar`, which showed the same split as a 12px
 * strip above four count tiles — the strip was too thin to read a proportion
 * from, and the tiles gave counts without shares, so neither told the reader
 * what fraction of the work sat in each state.
 *
 * The ring is decorative for assistive tech: the legend beside it is a real
 * list of links carrying label, count and percentage, so nothing here is the
 * only route to the data.
 */
function BucketDonut({ buckets, total }: { buckets: Bucket[]; total: number }) {
  // Memoised on purpose, now that the ring animates. Recharts compares a `Pie`'s
  // `data` by identity and restarts the draw-in when it changes, so a fresh
  // array on every render would replay the ring each time the dashboard
  // re-rendered for any reason (a refetch toggling `isFetching`, a widget
  // switched on). `buckets` itself only changes with the view.
  const data = useMemo(
    () =>
      buckets
        .map((b, i) => ({ ...b, ring: b.ring ?? i }))
        .filter((b) => b.count > 0)
        .sort((a, b) => a.ring - b.ring),
    [buckets],
  );
  const anim = chartAnimation();

  return (
    <div
      aria-hidden
      className="relative h-[132px] w-[132px] shrink-0"
    >
      {total === 0 || data.length === 0 ? (
        <div className="h-full w-full rounded-full border-8 border-muted/50" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={data.length > 1 ? 2 : 0}
              strokeWidth={0}
              {...anim}
            >
              {data.map((b) => (
                <Cell key={b.key} fill={b.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}

      {/* Total sits in the hole, where the eye already is. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum font-heading text-2xl font-bold leading-none text-foreground">
          <AnimatedNumber value={total} format={String} />
        </span>
        <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          jobs
        </span>
      </div>
    </div>
  );
}
