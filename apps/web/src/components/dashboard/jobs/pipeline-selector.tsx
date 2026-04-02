"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { IconChevronDown, IconCheck, IconSettings } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Pipeline {
  id: string;
  name: string;
  label: string;
  isDefault: boolean;
  stageCount: number;
  jobCount: number;
}

interface PipelineSelectorProps {
  pipelines: Pipeline[];
  selectedId: string | null;
  onSelect: (pipelineId: string) => void;
}

export function PipelineSelector({
  pipelines,
  selectedId,
  onSelect,
}: PipelineSelectorProps) {
  const [open, setOpen] = useState(false);

  // Don't render if there's only one pipeline
  if (pipelines.length <= 1) return null;

  const selected = pipelines.find((p) => p.id === selectedId);
  const label = selected?.label ?? "Select Pipeline";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 font-body text-sm h-8"
        >
          <span className="truncate max-w-[160px]">{label}</span>
          <IconChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="space-y-0.5">
          {pipelines.map((pipeline) => (
            <button
              key={pipeline.id}
              onClick={() => {
                onSelect(pipeline.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-body transition-colors",
                pipeline.id === selectedId
                  ? "bg-brand-light/20 text-brand"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <IconCheck
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  pipeline.id === selectedId ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="truncate">{pipeline.label}</span>
              {pipeline.isDefault && (
                <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Default
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-1 border-t border-border pt-1">
          <Link
            href="/settings/pipelines"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <IconSettings className="h-3.5 w-3.5" />
            Manage Pipelines
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
