"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IconBriefcase } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { getPipelineStages } from "@/actions/pipeline-stages";
import { getStageColors } from "@/lib/constants/stage-color-presets";

interface PipelineStage {
  id: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
}

interface ConvertToJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (pipelineStageId: string) => void;
  loading: boolean;
  /** Description shown below the title */
  description?: React.ReactNode;
}

export function ConvertToJobDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  description,
}: ConvertToJobDialogProps) {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [loadingStages, setLoadingStages] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingStages(true);
    getPipelineStages().then((result) => {
      if (result.data) {
        const sorted = [...result.data].sort(
          (a: PipelineStage, b: PipelineStage) => a.sortOrder - b.sortOrder,
        );
        setStages(sorted);
        // Default to first stage
        if (sorted.length > 0 && !selectedStageId) {
          setSelectedStageId(sorted[0].id);
        }
      }
      setLoadingStages(false);
    });
  }, [open]);

  const handleConfirm = () => {
    if (!selectedStageId) return;
    onConfirm(selectedStageId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <IconBriefcase className="h-5 w-5 text-brand" />
            Convert to Job
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {description ?? (
            <p className="text-sm text-muted-foreground font-body">
              A new job will be created. Select which pipeline stage to place it in.
            </p>
          )}

          {/* Stage Picker */}
          <div className="space-y-2">
            <Label className="text-sm font-body">Pipeline Stage</Label>
            <div className="grid grid-cols-2 gap-2">
              {stages.map((stage) => {
                const colors = getStageColors(stage.color);
                const isSelected = selectedStageId === stage.id;
                return (
                  <Button
                    key={stage.id}
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedStageId(stage.id)}
                    className={cn(
                      "justify-start gap-2 h-auto px-3 py-2.5 text-sm font-medium",
                      isSelected
                        ? "border-brand ring-1 ring-brand/20 bg-brand/5"
                        : "hover:border-brand/40",
                    )}
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", colors.dot)} />
                    <span className="font-body">{stage.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !selectedStageId || loadingStages}
            className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
          >
            {loading ? "Converting..." : "Convert to Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
