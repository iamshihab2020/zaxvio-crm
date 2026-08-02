"use client";

import { useState, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  IconGripVertical,
  IconTrash,
  IconPlus,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconDots,
} from "@tabler/icons-react";
import {
  STAGE_COLOR_KEYS,
  STAGE_COLOR_PRESETS,
  getStageColors,
} from "@/lib/constants/stage-color-presets";
import {
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  reorderPipelineStages,
} from "@/actions/pipeline-stages";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StageLifecycle } from "@/lib/constants/stage-lifecycle";

interface PipelineStageWithCount {
  id: string;
  name: string;
  label: string;
  color: string;
  lifecycle: StageLifecycle;
  sortOrder: number;
  isDefault: boolean;
  jobCount: number;
}

type StageEdit = { label?: string; color?: string; lifecycle?: StageLifecycle };

/**
 * Only two stages in a pipeline need to mean anything to the system: the one
 * that finishes a job and the one that abandons it. Everything else is just
 * workflow — a lead, an appointment, a survey, parts on order — and asking
 * "counts as?" on every row four times over made the common stage look like it
 * needed a decision when it does not.
 *
 * So the control is a *marker*, not a classifier: unmarked is the default and
 * says nothing, and only the two ends carry a badge. Underneath, an unmarked
 * stage is still `scheduled` — open work — which is what makes moving freely
 * between any number of middle stages legal.
 */
type StageMark = "completed" | "cancelled" | "none";

function markOf(lifecycle: StageLifecycle): StageMark {
  return lifecycle === "completed" || lifecycle === "cancelled"
    ? lifecycle
    : "none";
}

const MARK_META: Record<
  Exclude<StageMark, "none">,
  { badge: string; menu: string; className: string }
> = {
  completed: {
    badge: "Completes job",
    menu: "Completes the job",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  cancelled: {
    badge: "Cancels job",
    menu: "Cancels the job",
    className: "border-border bg-muted text-muted-foreground",
  },
};

function StageMarkMenu({
  mark,
  onChange,
}: {
  mark: StageMark;
  onChange: (next: StageMark) => void;
}) {
  const options: { value: StageMark; label: string; hint: string }[] = [
    {
      value: "none",
      label: "No special meaning",
      hint: "Just a step in the workflow",
    },
    {
      value: "completed",
      label: MARK_META.completed.menu,
      hint: "Stamps the completion date and sends the completion email",
    },
    {
      value: "cancelled",
      label: MARK_META.cancelled.menu,
      hint: "Drops the job out of active work",
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          title="What this stage means"
        >
          <IconDots className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[11px] font-body font-normal text-muted-foreground">
          When a job lands here
        </DropdownMenuLabel>
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => onChange(o.value)}
            className="flex-col items-start gap-0.5"
          >
            <span className="flex w-full items-center gap-2 text-sm font-body">
              <IconCheck
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  mark === o.value ? "opacity-100 text-brand" : "opacity-0",
                )}
              />
              {o.label}
            </span>
            <span className="pl-[1.375rem] text-[11px] font-body text-muted-foreground">
              {o.hint}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface PipelineStagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStageWithCount[];
  pipelineId: string | null;
  onStagesChange: () => void;
}

/* ── Sortable stage row ────────────────────────────────────── */

function SortableStageRow({
  stage,
  onUpdate,
  onMark,
  onDelete,
}: {
  stage: PipelineStageWithCount;
  onUpdate: (id: string, data: StageEdit) => void;
  onMark: (id: string, mark: StageMark) => void;
  onDelete: (id: string) => void;
}) {
  const mark = markOf(stage.lifecycle);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(stage.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function handleSaveLabel() {
    const trimmed = editLabel.trim();
    if (!trimmed || trimmed === stage.label) {
      setEditLabel(stage.label);
      setEditing(false);
      return;
    }
    onUpdate(stage.id, { label: trimmed });
    setEditing(false);
  }

  const colors = getStageColors(stage.color);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border border-border bg-card px-3 py-2",
        isDragging && "shadow-lg ring-2 ring-brand/30",
      )}
    >
      <div className="flex items-center gap-3">
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <IconGripVertical className="h-4 w-4" />
      </button>

      {/* Color picker */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "h-4 w-4 rounded-full shrink-0 cursor-pointer ring-1 ring-border hover:ring-2 hover:ring-brand/40 transition-shadow",
              colors.dot,
            )}
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1.5">
            {STAGE_COLOR_KEYS.map((key) => {
              const preset = STAGE_COLOR_PRESETS[key];
              return (
                <button
                  key={key}
                  onClick={() => onUpdate(stage.id, { color: key })}
                  className={cn(
                    "h-6 w-6 rounded-full cursor-pointer ring-1 ring-border transition-all",
                    preset.dot,
                    stage.color === key && "ring-2 ring-brand scale-110",
                  )}
                />
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Label (inline edit) */}
      {editing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <Input
            ref={inputRef}
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveLabel();
              if (e.key === "Escape") {
                setEditLabel(stage.label);
                setEditing(false);
              }
            }}
            className="h-7 text-sm"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSaveLabel}
            className="h-7 w-7 text-green-600 hover:text-green-700"
          >
            <IconCheck className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditLabel(stage.label);
              setEditing(false);
            }}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <IconX className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
          className="flex-1 justify-start text-sm font-medium text-foreground font-body hover:text-brand truncate"
        >
          {stage.label}
        </Button>
      )}

      {/* Only a marked stage says anything; the rest stay quiet. */}
      {mark !== "none" && (
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-body font-medium",
            MARK_META[mark].className,
          )}
        >
          {MARK_META[mark].badge}
        </span>
      )}

      {/* Job count badge */}
      {stage.jobCount > 0 && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground shrink-0">
          {stage.jobCount}
        </span>
      )}

      <StageMarkMenu mark={mark} onChange={(next) => onMark(stage.id, next)} />

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(stage.id)}
        disabled={stage.jobCount > 0}
        className={cn(
          "shrink-0 h-7 w-7",
          stage.jobCount > 0
            ? "text-muted-foreground/30"
            : "text-muted-foreground hover:text-destructive",
        )}
        title={
          stage.jobCount > 0
            ? `Cannot delete: ${stage.jobCount} job(s) in this stage`
            : "Delete stage"
        }
      >
        <IconTrash className="h-4 w-4" />
      </Button>
      </div>
    </div>
  );
}

/* ── Main dialog ───────────────────────────────────────────── */

export function PipelineStagesDialog({
  open,
  onOpenChange,
  stages,
  pipelineId,
  onStagesChange,
}: PipelineStagesDialogProps) {
  const [localStages, setLocalStages] = useState(stages);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("gray");
  const newInputRef = useRef<HTMLInputElement>(null);

  // Sync from parent
  useEffect(() => {
    setLocalStages(stages);
  }, [stages]);

  useEffect(() => {
    if (adding) newInputRef.current?.focus();
  }, [adding]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localStages.findIndex((s) => s.id === active.id);
    const newIndex = localStages.findIndex((s) => s.id === over.id);

    const reordered = arrayMove(localStages, oldIndex, newIndex);
    setLocalStages(reordered);

    const result = await reorderPipelineStages(reordered.map((s) => s.id));
    if (result.error) {
      toast.error(result.error);
      setLocalStages(stages); // revert
    } else {
      onStagesChange();
    }
  }

  async function handleUpdate(id: string, data: StageEdit) {
    // Optimistic update
    setLocalStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...data } : s)),
    );

    const result = await updatePipelineStage(id, data);
    if (result.error) {
      toast.error(result.error);
      setLocalStages(stages); // revert
    } else {
      onStagesChange();
    }
  }

  /**
   * Marking is exclusive: a pipeline has one stage that finishes a job and one
   * that abandons it. Moving the mark clears it from whichever stage held it,
   * so a board can never present two different "Done" columns that both claim
   * to complete the work.
   */
  async function handleMark(id: string, mark: StageMark) {
    const target = localStages.find((s) => s.id === id);
    if (!target || markOf(target.lifecycle) === mark) return;

    const lifecycle: StageLifecycle = mark === "none" ? "scheduled" : mark;
    const displaced =
      mark === "none"
        ? []
        : localStages.filter((s) => s.id !== id && s.lifecycle === mark);

    setLocalStages((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, lifecycle }
          : displaced.some((d) => d.id === s.id)
            ? { ...s, lifecycle: "scheduled" as StageLifecycle }
            : s,
      ),
    );

    // Issued together rather than one-at-a-time in a loop (ARC-18). The first
    // error rolls the whole optimistic update back, as before.
    const clearedResults = await Promise.all(
      displaced.map((stage) =>
        updatePipelineStage(stage.id, { lifecycle: "scheduled" }),
      ),
    );
    const clearFailure = clearedResults.find((r) => r.error);
    if (clearFailure) {
      toast.error(clearFailure.error!);
      setLocalStages(stages);
      return;
    }

    const result = await updatePipelineStage(id, { lifecycle });
    if (result.error) {
      toast.error(result.error);
      setLocalStages(stages);
      return;
    }

    toast.success(
      mark === "none"
        ? `"${target.label}" no longer changes a job's state`
        : `"${target.label}" now ${MARK_META[mark].menu.toLowerCase()}`,
    );
    onStagesChange();
  }

  async function handleDelete(id: string) {
    const stage = localStages.find((s) => s.id === id);
    if (!stage) return;

    if (stage.jobCount > 0) {
      toast.error(
        `Cannot delete "${stage.label}": ${stage.jobCount} job(s) are in this stage`,
      );
      return;
    }

    setLocalStages((prev) => prev.filter((s) => s.id !== id));

    const result = await deletePipelineStage(id);
    if (result.error) {
      toast.error(result.error);
      setLocalStages(stages); // revert
    } else {
      toast.success("Stage deleted");
      onStagesChange();
    }
  }

  async function handleAdd() {
    const trimmed = newLabel.trim();
    if (!trimmed) return;

    if (!pipelineId) return;
    const result = await createPipelineStage({
      label: trimmed,
      color: newColor,
      pipelineId,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Stage added");
      setNewLabel("");
      setNewColor("gray");
      setAdding(false);
      onStagesChange();
    }
  }

  /**
   * A pipeline with nothing marked Completed is a pipeline jobs can never
   * finish in: no completion date, no completion email, nothing counted as done
   * in reports. Worth saying out loud rather than letting it be discovered a
   * month later in an empty report.
   */
  const hasCompletedStage = localStages.some((s) => s.lifecycle === "completed");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Manage Pipeline</DialogTitle>
          <DialogDescription className="font-body text-sm">
            Name your stages whatever your business calls them, and add as many
            as you need. Only two carry meaning: mark the one that{" "}
            <strong className="font-medium text-foreground">completes</strong> a
            job and the one that{" "}
            <strong className="font-medium text-foreground">cancels</strong> it,
            from each stage&rsquo;s ⋯ menu. Drag to reorder.
          </DialogDescription>
        </DialogHeader>

        {!hasCompletedStage && localStages.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs font-body text-amber-700 dark:text-amber-400">
              No stage completes a job, so work in this pipeline can never
              finish. Pick one from its ⋯ menu.
            </p>
          </div>
        )}

        <div className="space-y-2 max-h-[400px] overflow-y-auto py-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localStages.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {localStages.map((stage) => (
                <SortableStageRow
                  key={stage.id}
                  stage={stage}
                  onUpdate={handleUpdate}
                  onMark={handleMark}
                  onDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Add stage form */}
        {adding ? (
          <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            {/* Color picker for new stage */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "h-4 w-4 rounded-full shrink-0 cursor-pointer ring-1 ring-border",
                    getStageColors(newColor).dot,
                  )}
                />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex gap-1.5">
                  {STAGE_COLOR_KEYS.map((key) => (
                    <button
                      key={key}
                      onClick={() => setNewColor(key)}
                      className={cn(
                        "h-6 w-6 rounded-full cursor-pointer ring-1 ring-border transition-all",
                        STAGE_COLOR_PRESETS[key].dot,
                        newColor === key && "ring-2 ring-brand scale-110",
                      )}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Input
              ref={newInputRef}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewLabel("");
                }
              }}
              placeholder="Stage name..."
              className="h-8 text-sm flex-1"
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newLabel.trim()}
              className="bg-brand text-brand-foreground hover:bg-brand/90 h-8 cursor-pointer"
            >
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setNewLabel("");
              }}
              className="h-8 cursor-pointer"
            >
              Cancel
            </Button>
          </div>

          <p className="pl-7 text-[11px] font-body text-muted-foreground">
            A new stage is a normal step in the workflow. Use its ⋯ menu if this
            is the one that completes or cancels a job.
          </p>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
            className="w-full cursor-pointer"
          >
            <IconPlus className="mr-2 h-4 w-4" />
            Add Stage
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
