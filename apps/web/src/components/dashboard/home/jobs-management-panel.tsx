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
import { STAGE_COLOR_PRESETS } from "@/lib/constants/stage-color-presets";
import {
  JOB_PRIORITY_CHART_COLORS,
  type JobPriority,
} from "@/lib/constants/job-options";
import {
  MAX_CATEGORIES,
  OTHER_COLOR,
  categoricalColor,
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

interface Bucket {
  key: string;
  label: string;
  count: number;
  color: string;
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
      // Use DB-stored stage colors so the widget matches the user's pipeline config.
      // Only trust values that look like CSS colors (#hex, hsl(...), rgb(...),
      // or a recognizable named color) — empty strings, null, or random values
      // would render as transparent and break the legend.
      return pipeline.map((p, i) => ({
        key: p.stageName,
        label: p.stageLabel,
        count: p.count,
        color: resolveStageColor(p.stageColor, i),
      }));
    }
    if (segment === "priority") {
      return priorityBreakdown.map((p) => ({
        key: p.key,
        label: p.label,
        count: p.count,
        color:
          p.key in JOB_PRIORITY_CHART_COLORS
            ? JOB_PRIORITY_CHART_COLORS[p.key as JobPriority]
            : "hsl(var(--brand))",
      }));
    }
    // Service types have no stored colour, so they take the categorical slots
    // in count order. That way every pair of touching slices is a pair of
    // neighbouring slots, which is exactly the pairing the palette was
    // validated for. Keying the colour to the type would hold steadier across
    // date ranges, but seven types against five validated slots would put
    // unchecked pairs side by side. The old palette cycled instead (`i % 8`),
    // so a ninth type quietly shared the first type's colour. The tail now
    // folds into one neutral "Other", and so does the literal "other" type.
    const ranked = [...serviceBreakdown]
      .filter((s) => s.key !== "other")
      .sort((a, b) => b.count - a.count);
    const named: Bucket[] = ranked.slice(0, MAX_CATEGORIES).map((s, i) => ({
      key: s.key,
      label: s.label,
      count: s.count,
      color: categoricalColor(i),
    }));
    const tail = [
      ...ranked.slice(MAX_CATEGORIES),
      ...serviceBreakdown.filter((s) => s.key === "other"),
    ];
    if (tail.length === 0) return named;
    if (tail.length === 1) return [...named, { ...tail[0]!, color: OTHER_COLOR }];
    return [
      ...named,
      {
        key: OTHER_BUCKET,
        label: `Other (${tail.length})`,
        count: tail.reduce((sum, s) => sum + s.count, 0),
        color: OTHER_COLOR,
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
 * Resolve the CSS color for a stage. The pipeline_stages.color column stores a
 * preset KEY (see `STAGE_COLOR_PRESETS`), e.g. "brand" or "purple". This function
 * looks up the matching `hex` from that single source of truth, with fallbacks
 * for legacy rows that stored raw CSS colors or for stages with missing values.
 */
function resolveStageColor(raw: string | null | undefined, index: number): string {
  const trimmed = raw?.trim();
  if (!trimmed) return categoricalColor(index);
  const preset = STAGE_COLOR_PRESETS[trimmed];
  if (preset) return preset.hex;
  // Legacy: some older stages may have stored a literal CSS color.
  if (/^(#[0-9a-f]{3,8}|hsl\(|rgb\(|hsla\(|rgba\()/i.test(trimmed)) {
    return trimmed;
  }
  return categoricalColor(index);
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
  const data = useMemo(() => buckets.filter((b) => b.count > 0), [buckets]);
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
