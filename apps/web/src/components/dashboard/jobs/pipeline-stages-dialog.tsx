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

interface PipelineStageWithCount {
  id: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  jobCount: number;
}

interface PipelineStagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStageWithCount[];
  onStagesChange: () => void;
}

/* ── Sortable stage row ────────────────────────────────────── */

function SortableStageRow({
  stage,
  onUpdate,
  onDelete,
}: {
  stage: PipelineStageWithCount;
  onUpdate: (id: string, data: { label?: string; color?: string }) => void;
  onDelete: (id: string) => void;
}) {
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
        "flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2",
        isDragging && "shadow-lg ring-2 ring-brand/30",
      )}
    >
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
          <button
            onClick={handleSaveLabel}
            className="text-green-600 hover:text-green-700 cursor-pointer"
          >
            <IconCheck className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setEditLabel(stage.label);
              setEditing(false);
            }}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex-1 text-left text-sm font-medium text-foreground font-body cursor-pointer hover:text-brand transition-colors truncate"
        >
          {stage.label}
        </button>
      )}

      {/* Job count badge */}
      {stage.jobCount > 0 && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground shrink-0">
          {stage.jobCount}
        </span>
      )}

      {/* Delete button */}
      <button
        onClick={() => onDelete(stage.id)}
        disabled={stage.jobCount > 0}
        className={cn(
          "shrink-0 cursor-pointer transition-colors",
          stage.jobCount > 0
            ? "text-muted-foreground/30 cursor-not-allowed"
            : "text-muted-foreground hover:text-destructive",
        )}
        title={
          stage.jobCount > 0
            ? `Cannot delete: ${stage.jobCount} job(s) in this stage`
            : "Delete stage"
        }
      >
        <IconTrash className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ── Main dialog ───────────────────────────────────────────── */

export function PipelineStagesDialog({
  open,
  onOpenChange,
  stages,
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

  async function handleUpdate(
    id: string,
    data: { label?: string; color?: string },
  ) {
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

    const result = await createPipelineStage({
      label: trimmed,
      color: newColor,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Manage Pipeline</DialogTitle>
          <DialogDescription className="font-body text-sm">
            Add, rename, recolor, reorder, or remove stages. Drag to reorder.
          </DialogDescription>
        </DialogHeader>

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
                  onDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Add stage form */}
        {adding ? (
          <div className="flex items-center gap-2 pt-1">
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
