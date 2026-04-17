"use client";

import { useMemo, useState } from "react";
import type {
  DashboardCategoryCount,
  DashboardPipelineItem,
  Pipeline,
} from "@hvac-saas/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePipelines } from "@/hooks/queries/use-pipelines";
import { STAGE_COLOR_PRESETS } from "@/lib/constants/stage-color-presets";
import { cn } from "@/lib/utils";

interface JobsManagementPanelProps {
  pipeline: DashboardPipelineItem[];
  priorityBreakdown: DashboardCategoryCount[];
  serviceBreakdown: DashboardCategoryCount[];
  pipelineId: string | null;
  onPipelineChange: (id: string | null) => void;
}

type Segment = "status" | "priority" | "service";

// Brand-orange + warm neutrals palette for buckets that don't have a DB color
// (priority, service type). Status uses the pipeline's stored stage colors.
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

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#f87171",
  high: "#fbbf24",
  normal: "hsl(var(--brand))",
  low: "#94a3b8",
};


interface Bucket {
  key: string;
  label: string;
  count: number;
  color: string;
}

export function JobsManagementPanel({
  pipeline,
  priorityBreakdown,
  serviceBreakdown,
  pipelineId,
  onPipelineChange,
}: JobsManagementPanelProps) {
  const [segment, setSegment] = useState<Segment>("status");
  const { data: pipelinesRes } = usePipelines();
  const pipelines = (pipelinesRes ?? []) as Pipeline[];

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
        color: PRIORITY_COLORS[p.key] ?? "hsl(var(--brand))",
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
          <span className="whitespace-nowrap text-xs font-body text-muted-foreground">
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
        <TabsContent value={segment} className="mt-4 flex-1">
          <SegmentBar buckets={buckets} total={total} />
          <ul className="mt-5 grid grid-cols-2 gap-3">
            {buckets.length === 0 ? (
              <li className="col-span-2 rounded-xl border border-dashed border-border bg-muted/10 p-4 text-center text-xs font-body text-muted-foreground">
                No data in current range.
              </li>
            ) : (
              buckets.map((b) => (
                <li
                  key={b.key}
                  className="rounded-xl border border-border bg-background/40 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="truncate text-[11px] font-body text-muted-foreground">
                      {b.label}
                    </span>
                  </div>
                  <div className="mt-1 font-heading text-xl font-semibold text-foreground">
                    {b.count}
                    <span className="ml-1 text-[11px] font-body font-normal text-muted-foreground">
                      jobs
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
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

function SegmentBar({ buckets, total }: { buckets: Bucket[]; total: number }) {
  if (total === 0) {
    return <div className="h-3 w-full rounded-full bg-muted/50" aria-hidden />;
  }
  return (
    <div
      className={cn(
        "flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted/50 ring-1 ring-border/50",
      )}
    >
      {buckets.map((b) => (
        <div
          key={b.key}
          className="h-full transition-all first:rounded-l-full last:rounded-r-full"
          style={{
            width: `${(b.count / total) * 100}%`,
            backgroundColor: b.color,
          }}
          title={`${b.label}: ${b.count}`}
        />
      ))}
    </div>
  );
}
