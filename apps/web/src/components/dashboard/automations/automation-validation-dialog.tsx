"use client";

import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import type { GraphIssue } from "@hvac-saas/workflow-nodes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { WorkflowValidation } from "@/actions/workflows";
import { cn } from "@/lib/utils";

/**
 * Why a publish was refused.
 *
 * A dialog rather than a toast, because this is a list the user has to work
 * through, and a toast that disappears is the wrong home for it.
 *
 * `onSelectNode` is the part that matters ([[wf-08-builder-frontend|S-4]]): each
 * error must be able to select the step it is about. A list of errors you cannot
 * navigate to is barely better than no list. It is optional here only because
 * the canvas does not exist yet — the moment it does, this dialog already knows
 * how to drive it.
 */

interface Props {
  validation: WorkflowValidation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectNode?: (nodeId: string) => void;
}

export function AutomationValidationDialog({
  validation,
  open,
  onOpenChange,
  onSelectNode,
}: Props) {
  const errors = validation?.errors ?? [];
  const warnings = validation?.warnings ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-heading">
            This automation can&rsquo;t be published yet
          </DialogTitle>
          <DialogDescription className="font-body">
            {errors.length === 1
              ? "There is one thing to fix first."
              : `There are ${errors.length} things to fix first.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto py-2">
          {errors.length > 0 && (
            <IssueList
              issues={errors}
              tone="error"
              onSelectNode={onSelectNode}
              onNavigate={() => onOpenChange(false)}
            />
          )}

          {warnings.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground font-body">
                Worth a look — these don&rsquo;t block publishing
              </p>
              <IssueList
                issues={warnings}
                tone="warning"
                onSelectNode={onSelectNode}
                onNavigate={() => onOpenChange(false)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="font-body">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueList({
  issues,
  tone,
  onSelectNode,
  onNavigate,
}: {
  issues: GraphIssue[];
  tone: "error" | "warning";
  onSelectNode?: (nodeId: string) => void;
  onNavigate: () => void;
}) {
  const Icon = tone === "error" ? IconAlertTriangle : IconInfoCircle;

  return (
    <ul className="space-y-1.5">
      {issues.map((issue, index) => {
        const clickable = !!issue.nodeId && !!onSelectNode;

        const content = (
          <>
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                tone === "error" ? "text-destructive" : "text-muted-foreground",
              )}
            />
            <span className="text-sm font-body">{issue.message}</span>
          </>
        );

        return (
          <li key={`${issue.code}-${issue.nodeId ?? index}`}>
            {clickable ? (
              <button
                type="button"
                onClick={() => {
                  onSelectNode!(issue.nodeId!);
                  onNavigate();
                }}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                {content}
              </button>
            ) : (
              <div className="flex items-start gap-2 px-2 py-1.5">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
