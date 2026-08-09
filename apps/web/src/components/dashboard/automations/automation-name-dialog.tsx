"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Rename an automation from the list.
 *
 * **Rename only.** It used to serve creation too, and that was the wrong shape:
 * asking for a name before the user has built anything asks the one question
 * they cannot answer yet. Creating now goes straight into the builder on a
 * placeholder, where the name is edited inline in the toolbar and Publish
 * insists on a real one.
 *
 * This survives for the list page, where renaming without opening the builder
 * is a reasonable thing to want.
 */

export interface AutomationNameValues {
  name: string;
  description: string;
}

interface AutomationNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AutomationNameValues) => void;
  loading?: boolean;
  /** The automation being renamed. */
  initial: AutomationNameValues | null;
}

/** Mirrors `createWorkflowBody` in the API. Both sides enforce; neither guesses. */
const MAX_NAME = 120;
const MAX_DESCRIPTION = 2000;

export function AutomationNameDialog({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
  initial,
}: AutomationNameDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Reset when the dialog opens, not when it closes: resetting on close makes
  // the fields visibly blank during the exit animation.
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
  }, [open, initial]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_NAME && !loading;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({ name: trimmed, description: description.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-heading">Rename automation</DialogTitle>
            <DialogDescription className="font-body">
              Give this automation a name your team will recognise.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="automation-name" className="font-body">
                Name
              </Label>
              <Input
                id="automation-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_NAME}
                placeholder="Follow up after a completed job"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="automation-description" className="font-body">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="automation-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={MAX_DESCRIPTION}
                rows={3}
                placeholder="What this is for, so the next person knows before opening it."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="font-body"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-brand text-brand-foreground hover:bg-brand/90 font-body"
            >
              {loading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
