"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  DashboardCategoryCount,
  DashboardPipelineItem,
  Pipeline,
} from "@hvac-saas/types";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";

interface JobsManagementPanelProps {
  /** Default-pipeline distribution that came with the main dashboard payload. */
  defaultPipeline: DashboardPipelineItem[];
  priorityBreakdown: DashboardCategoryCount[];
  serviceBreakdown: DashboardCategoryCount[];
  pipelineId: string | null;
  onPipelineChange: (id: string | null) => void;
}

type Segment = "status" | "priority" | "service";

// Brand-orange + warm neutrals palette for buckets that don't have a DB color
// (service type). Status uses the pipeline's stored stage colors; priority uses
// the shared map keyed off the database enum.
const PALETTE = [
  "hsl(var(--brand))",
  "#fb923c",
  "#fbbf24",
  "#a78bfa",
  "#60a5fa",
  "#34d399",
  "#f87171",
  "#94a3b8",
];

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
    return serviceBreakdown.map((s, i) => ({
      key: s.key,
      label: s.label,
      count: s.count,
      color: PALETTE[i % PALETTE.length]!,
    }));
  }, [segment, pipeline, priorityBreakdown, serviceBreakdown]);

  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  // Resolve the currently-displayed pipeline id for the selector.
  // When `pipelineId` is null, backend returned the default — find it so the picker shows it.
  const defaultPipelineId =
    pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? "";
  const selectValue = pipelineId ?? defaultPipelineId;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="whitespace-nowrap font-heading text-sm font-semibold text-foreground">
          Jobs Management
        </h3>
        <div className="flex items-center gap-2">
          {pipelines.length > 0 && (
            <Select
              value={selectValue}
              onValueChange={(v) => onPipelineChange(v || null)}
            >
              <SelectTrigger className="h-7 w-auto max-w-[160px] rounded-full border-border/60 bg-muted/40 px-3 text-xs">
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
            {total} total
          </span>
        </div>
      </div>

      <Tabs
        value={segment}
        onValueChange={(v) => setSegment(v as Segment)}
        className="mt-3 flex flex-1 flex-col"
      >
        <TabsList className="h-8 bg-muted/40">
          <TabsTrigger value="status" className="text-xs">Status</TabsTrigger>
          <TabsTrigger value="priority" className="text-xs">Priority</TabsTrigger>
          <TabsTrigger value="service" className="text-xs">Service</TabsTrigger>
        </TabsList>
        <TabsContent value={segment} className="mt-4 min-h-0 flex-1 overflow-y-auto">
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
            <div className="rounded-xl border border-dashed border-border bg-muted/10 p-6 text-center text-xs font-body text-muted-foreground">
              No data in current range.
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
              <BucketDonut buckets={buckets} total={total} />

              <ul className="w-full min-w-0 flex-1 space-y-0.5">
                {buckets.map((b) => {
                  const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
                  return (
                    <li key={b.key}>
                      <Link
                        href={bucketHref(segment, b.key, pipelineId)}
                        aria-label={`${b.label}: ${b.count} jobs, ${pct}% of ${total}`}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-brand/5"
                      >
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: b.color }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-body text-muted-foreground">
                          {b.label}
                        </span>
                        <span className="tnum shrink-0 font-heading text-[15px] font-semibold text-foreground">
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
        </TabsContent>
      </Tabs>
    </div>
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
  if (segment === "service") params.set("serviceType", key);
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
  if (!trimmed) return PALETTE[index % PALETTE.length]!;
  const preset = STAGE_COLOR_PRESETS[trimmed];
  if (preset) return preset.hex;
  // Legacy: some older stages may have stored a literal CSS color.
  if (/^(#[0-9a-f]{3,8}|hsl\(|rgb\(|hsla\(|rgba\()/i.test(trimmed)) {
    return trimmed;
  }
  return PALETTE[index % PALETTE.length]!;
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
  const data = buckets.filter((b) => b.count > 0);

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
              isAnimationActive={false}
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
          {total}
        </span>
        <span className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          jobs
        </span>
      </div>
    </div>
  );
}
