"use client";

import { useState } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import { getDefinition } from "@hvac-saas/workflow-nodes";
import { resolveNodeIcon } from "@/lib/workflow/icon-map";
import { Button } from "@/components/ui/button";
import { RunStatusBadge } from "./run-status-badge";
import { formatDuration } from "./run-timing";
import { cn } from "@/lib/utils";
import type { WorkflowRunStep } from "@/actions/workflows";

/**
 * Every step the run took, in order.
 *
 * The engine has been writing this record since P3 — status, the settings after
 * variable resolution, why a step was skipped, how long it took, and the failure
 * in plain language — and until now nothing could read a word of it. This is
 * where it surfaces, so the ordering of what is shown matters:
 *
 *  1. **The plain-language reason first.** `error_hint` and `skip_reason` are
 *     written for the person who has to fix the automation. `error_message` is
 *     for an operator and is one disclosure away, not the headline. Workflow
 *     failures are the biggest support load a feature like this creates, and a
 *     stack trace moves that load rather than removing it.
 *  2. **Resolved settings, collapsed.** "What did this step actually try to do,
 *     after the variables were filled in" answers most of the rest — and it is
 *     the only place a `{{customer.firstName}}` that quietly resolved to nothing
 *     becomes visible.
 *
 * A **skipped** step is deliberately as prominent as a failed one. It is not a
 * lesser outcome: "we did not email them because they unsubscribed" is usually
 * the exact thing the person is here to find out, and a greyed-out row nobody
 * expands hides it.
 */

interface Props {
  steps: WorkflowRunStep[];
  /** Selects the step on the builder canvas, when opened from there. */
  onSelectNode?: (nodeId: string) => void;
}

export function RunStepList({ steps, onSelectNode }: Props) {
  if (steps.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground font-body">
        This run recorded no steps. That usually means it was stopped before its
        first step could start.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {steps.map((step) => (
        <StepRow key={step.id} step={step} onSelectNode={onSelectNode} />
      ))}
    </ol>
  );
}

function StepRow({ step, onSelectNode }: { step: WorkflowRunStep } & Pick<Props, "onSelectNode">) {
  const [open, setOpen] = useState(false);

  const def = getDefinition(step.nodeType);
  const Icon = resolveNodeIcon(def?.icon ?? "");
  const duration = formatDuration(step.durationMs);

  // The label the author gave it, falling back to the node's own name. Never
  // the raw node id — that is a UUID, and a timeline of UUIDs is a timeline
  // nobody reads.
  const title = step.nodeLabel?.trim() || def?.displayName || step.nodeType;

  const reason = step.errorHint ?? step.skipReason;
  const hasDetail = Boolean(
    step.errorMessage || hasKeys(step.resolvedParams) || hasKeys(step.output),
  );

  return (
    <li
      className={cn(
        "rounded-lg border bg-card",
        step.status === "failed" ? "border-red-500/40" : "border-border",
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* The sequence number is real information — it is the order the
                engine ran them in, which after a branch is not the order they
                appear on the canvas. */}
            <span className="font-mono text-xs text-muted-foreground">
              {step.sequence}
            </span>
            <p className="truncate font-heading text-sm font-semibold">{title}</p>
            <RunStatusBadge status={step.status} kind="step" />
            {duration && (
              <span className="font-mono text-xs text-muted-foreground">{duration}</span>
            )}
          </div>

          {reason && (
            <p
              className={cn(
                "mt-1 text-sm font-body",
                step.status === "failed" ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
              )}
            >
              {reason}
            </p>
          )}

          {(hasDetail || onSelectNode) && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {hasDetail && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setOpen((prev) => !prev)}
                  aria-expanded={open}
                >
                  <IconChevronRight
                    className={cn(
                      "mr-1 h-3.5 w-3.5 transition-transform",
                      open && "rotate-90",
                    )}
                  />
                  {open ? "Hide details" : "Details"}
                </Button>
              )}
              {onSelectNode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onSelectNode(step.nodeId)}
                >
                  Show on canvas
                </Button>
              )}
            </div>
          )}

          {open && (
            <div className="mt-2 space-y-3 border-t border-border pt-3">
              {hasKeys(step.resolvedParams) && (
                <Detail
                  title="What it tried to do"
                  hint="Your settings with the variables filled in."
                  value={step.resolvedParams}
                />
              )}
              {hasKeys(step.output) && (
                <Detail title="What came back" value={step.output} />
              )}
              {step.errorMessage && step.errorMessage !== step.errorHint && (
                <Detail
                  title="Technical detail"
                  hint="Paste this if you contact support."
                  value={step.errorMessage}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function Detail({
  title,
  hint,
  value,
}: {
  title: string;
  hint?: string;
  value: unknown;
}) {
  return (
    <div>
      <p className="font-heading text-xs font-semibold">{title}</p>
      {hint && <p className="text-xs text-muted-foreground font-body">{hint}</p>}
      {/* `overflow-x-auto` on the block itself: a long resolved value is exactly
          what someone is here to read, and clipping it would defeat the point —
          but the page must not scroll sideways because of it. */}
      <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-xs leading-relaxed">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/** An object with something in it. `{}` is stored freely and shows nothing. */
function hasKeys(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}
