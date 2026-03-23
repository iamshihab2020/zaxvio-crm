"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { IconLock, IconChecklist, IconPackage } from "@tabler/icons-react";
import { toggleChecklistItem } from "@/actions/jobs";

interface ChecklistItem {
  id: string;
  checklistItemId: string;
  isCompleted: boolean;
  completedBy: string | null;
  completedAt: string | null;
  label: string;
  isRequired: boolean;
  catalogItemId: string | null;
  sortOrder: number | null;
  catalogItemName: string | null;
  catalogItemPrice: string | null;
}

interface JobDetailChecklistProps {
  jobId: string;
  checklist: ChecklistItem[];
  onUpdate: () => void;
}

export function JobDetailChecklist({
  jobId,
  checklist,
  onUpdate,
}: JobDetailChecklistProps) {
  const [localChecklist, setLocalChecklist] = useState(checklist);
  const [toggling, setToggling] = useState<string | null>(null);

  // Sync from parent when fresh data arrives
  if (checklist !== localChecklist && !toggling) {
    setLocalChecklist(checklist);
  }

  const completedCount = localChecklist.filter((c) => c.isCompleted).length;
  const totalCount = localChecklist.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  async function handleToggle(item: ChecklistItem) {
    const newValue = !item.isCompleted;

    // Optimistic update — toggle immediately in UI
    setToggling(item.id);
    setLocalChecklist((prev) =>
      prev.map((c) =>
        c.id === item.id ? { ...c, isCompleted: newValue } : c,
      ),
    );

    const result = await toggleChecklistItem(jobId, item.id, newValue);
    setToggling(null);
    if (result.error) {
      // Revert on failure
      setLocalChecklist((prev) =>
        prev.map((c) =>
          c.id === item.id ? { ...c, isCompleted: !newValue } : c,
        ),
      );
      toast.error(result.error);
    } else {
      // Silent refresh to sync tab counts + line items (if auto-added)
      onUpdate();
    }
  }

  if (localChecklist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-8 text-center">
        <IconChecklist className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground font-body">
          No checklist attached
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Create a checklist template in Settings to auto-attach
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-foreground font-body">
            Progress
          </span>
          <span className="text-sm text-muted-foreground font-body">
            {completedCount}/{totalCount} completed
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Checklist items */}
      <div className="space-y-1">
        {localChecklist.map((item) => (
          <div key={item.id}>
            <label
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors",
                item.isCompleted
                  ? "bg-muted/20"
                  : "hover:bg-muted/30",
                toggling === item.id && "opacity-60",
              )}
            >
              <input
                type="checkbox"
                checked={item.isCompleted}
                onChange={() => handleToggle(item)}
                disabled={toggling === item.id}
                className="h-4 w-4 rounded border-border accent-brand cursor-pointer"
              />
              <span
                className={cn(
                  "flex-1 text-sm font-body",
                  item.isCompleted
                    ? "text-muted-foreground line-through"
                    : "text-foreground",
                )}
              >
                {item.label}
              </span>
              {item.isRequired && (
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <IconLock className="h-3 w-3" />
                  Required
                </span>
              )}
            </label>
            {!item.isCompleted && item.catalogItemId && item.catalogItemName && (
              <div className="flex items-center gap-1.5 pl-10 pb-1 text-xs text-muted-foreground">
                <IconPackage className="h-3 w-3 shrink-0" />
                <span>
                  Will auto-add {item.catalogItemName}
                  {item.catalogItemPrice && (
                    <> (${parseFloat(item.catalogItemPrice).toFixed(2)})</>
                  )}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
