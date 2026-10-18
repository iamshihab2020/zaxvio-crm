"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconChevronDown, IconCheck, IconAdjustments } from "@tabler/icons-react";

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
  onManageStages?: () => void;
}

export function PipelineTabs({
  pipelines,
  selectedId,
  onSelect,
  onManageStages,
}: PipelineTabsProps) {
  const [open, setOpen] = useState(false);

  if (pipelines.length === 0) return <span className="text-xs text-muted-foreground px-2">No pipelines</span>;

  const selected = pipelines.find((p) => p.id === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Full-width and left-aligned on a phone, where it is a line of its own
          and reads as a select field; a compact button from `sm`. */}
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-full justify-between gap-1.5 px-2.5 text-xs font-semibold font-body rounded-lg hover:bg-muted/60 sm:h-7 sm:w-auto sm:justify-center"
        >
          <span className="min-w-0 truncate sm:max-w-[140px]">
            {selected?.label ?? "Select Pipeline"}
          </span>
          <IconChevronDown
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {pipelines.map((pipeline) => (
          <Button
            key={pipeline.id}
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelect(pipeline.id);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 h-10 sm:h-8 rounded-md px-2 text-sm font-body justify-start",
              pipeline.id === selectedId
                ? "bg-brand-light/30 text-brand-ink dark:bg-brand/15"
                : "text-foreground",
            )}
          >
            <span className="flex-1 text-left truncate">{pipeline.label}</span>
            {pipeline.id === selectedId && (
              <IconCheck className="h-3.5 w-3.5 text-brand-ink shrink-0" />
            )}
          </Button>
        ))}

        {onManageStages && (
          <>
            <div className="h-px bg-border/60 my-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                onManageStages();
              }}
              className="flex w-full items-center gap-2 h-10 sm:h-7 rounded-md px-2 text-xs font-body text-muted-foreground hover:text-foreground justify-start"
            >
              <IconAdjustments className="h-3.5 w-3.5" />
              Manage Stages
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
