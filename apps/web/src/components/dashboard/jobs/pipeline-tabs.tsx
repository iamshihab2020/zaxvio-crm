"use client";

import {
  Highlight,
  HighlightItem,
} from "@/components/animate-ui/primitives/effects/highlight";
import { cn } from "@/lib/utils";

interface Pipeline {
  id: string;
  name: string;
  label: string;
  isDefault: boolean;
  stageCount: number;
  jobCount: number;
}

interface PipelineTabsProps {
  pipelines: Pipeline[];
  selectedId: string | null;
  onSelect: (pipelineId: string) => void;
}

export function PipelineTabs({
  pipelines,
  selectedId,
  onSelect,
}: PipelineTabsProps) {
  if (pipelines.length === 0) return null;

  return (
    <Highlight
      className="rounded-md bg-brand-light dark:bg-brand/20"
      value={selectedId}
      controlledItems
    >
      <div className="flex items-center gap-0.5 rounded-lg bg-muted/80 dark:bg-muted/30 p-0.5">
        {pipelines.map((pipeline) => (
          <HighlightItem key={pipeline.id} value={pipeline.id}>
            <button
              onClick={() => onSelect(pipeline.id)}
              className={cn(
                "relative z-10 rounded-md px-2.5 py-1 text-xs font-semibold font-body transition-colors whitespace-nowrap",
                pipeline.id === selectedId
                  ? "text-brand"
                  : "text-foreground/80 hover:text-foreground",
              )}
            >
              {pipeline.label}
            </button>
          </HighlightItem>
        ))}
      </div>
    </Highlight>
  );
}
