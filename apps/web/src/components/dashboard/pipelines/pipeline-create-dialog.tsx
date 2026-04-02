"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPipeline } from "@/actions/pipelines";
import { toast } from "sonner";

interface PipelineCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  existingPipelines: { id: string; label: string }[];
}

export function PipelineCreateDialog({
  open,
  onOpenChange,
  onCreated,
  existingPipelines,
}: PipelineCreateDialogProps) {
  const [label, setLabel] = useState("");
  const [stageOption, setStageOption] = useState<"default" | "copy" | "empty">("default");
  const [copyFromId, setCopyFromId] = useState("");
  const [saving, setSaving] = useState(false);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setLabel("");
      setStageOption("default");
      setCopyFromId("");
    }
    onOpenChange(open);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;

    setSaving(true);
    const result = await createPipeline({
      label: trimmed,
      seedDefaultStages: stageOption === "default",
      copyFromPipelineId: stageOption === "copy" ? copyFromId : undefined,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      onCreated();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Create Pipeline</DialogTitle>
          <DialogDescription className="font-body">
            Add a new pipeline to organize your jobs with custom stages.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pipeline-name" className="font-body text-sm">
              Pipeline Name
            </Label>
            <Input
              id="pipeline-name"
              placeholder="e.g., Residential, Commercial, Maintenance"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="font-body text-sm">Initial Stages</Label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="stageOption"
                  checked={stageOption === "default"}
                  onChange={() => setStageOption("default")}
                  className="accent-brand"
                />
                <span className="text-sm font-body">Start with default stages</span>
              </label>

              {existingPipelines.length > 0 && (
                <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="radio"
                    name="stageOption"
                    checked={stageOption === "copy"}
                    onChange={() => setStageOption("copy")}
                    className="accent-brand"
                  />
                  <span className="text-sm font-body">Copy from existing pipeline</span>
                </label>
              )}

              {stageOption === "copy" && (
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-body"
                  value={copyFromId}
                  onChange={(e) => setCopyFromId(e.target.value)}
                >
                  <option value="">Select a pipeline...</option>
                  {existingPipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}

              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="stageOption"
                  checked={stageOption === "empty"}
                  onChange={() => setStageOption("empty")}
                  className="accent-brand"
                />
                <span className="text-sm font-body">Start empty</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-brand text-brand-foreground hover:bg-brand/90"
              disabled={!label.trim() || saving || (stageOption === "copy" && !copyFromId)}
            >
              {saving ? "Creating..." : "Create Pipeline"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
