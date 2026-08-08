"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IconX,
  IconTrash,
  IconEyeOff,
  IconEye,
  IconAlertTriangle,
} from "@tabler/icons-react";
import {
  getDefinition,
  getMissingRequiredFields,
  resolveNodeColor,
  subjectsProvidedBy,
  type SubjectType,
} from "@hvac-saas/workflow-nodes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBuilderStore } from "@/lib/workflow/store";
import { resolveNodeIcon } from "@/lib/workflow/icon-map";
import { useBuilderContext } from "@/hooks/queries";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { ConfigRenderer } from "./config-renderer";
import { NodePreviewPanel } from "./node-preview";
import { cn } from "@/lib/utils";

/**
 * The step's settings.
 *
 * **A drawer over the canvas, not a modal** (L-2): you need to see the graph
 * while editing a step, because half the questions the form raises ("which
 * branch is this on?", "what runs before it?") are answered by looking at it.
 * No overlay, no focus trap — the canvas stays live behind it.
 *
 * Everything inside is generated from the node's definition. There is no
 * per-node component and there should not be one until a node genuinely cannot
 * be expressed as a list of fields.
 */

interface Props {
  workflowId: string;
  readOnly?: boolean;
}

export function ConfigPanel({ workflowId, readOnly }: Props) {
  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId);
  const nodes = useBuilderStore((s) => s.nodes);
  const select = useBuilderStore((s) => s.select);
  const setNodeParameter = useBuilderStore((s) => s.setNodeParameter);
  const renameNode = useBuilderStore((s) => s.renameNode);
  const toggleDisabled = useBuilderStore((s) => s.toggleNodeDisabled);
  const deleteNode = useBuilderStore((s) => s.deleteNode);

  const node = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const definition = node ? getDefinition(node.nodeType) : undefined;

  // One batch request per automation, cached forever — the pickers read from
  // it rather than each fetching their own list.
  const contextQuery = useBuilderContext(workflowId);
  const context = contextQuery.data?.data ?? null;

  /**
   * What this automation's trigger provides — the scope for the variable picker.
   *
   * Reuses `subjectsProvidedBy`, the same function the publish validator uses to
   * decide whether a step can ever run. One implementation means the picker
   * cannot offer a variable the validator would then reject the graph over.
   *
   * `null` when there is no trigger yet, or when two triggers disagree: the
   * picker then offers everything rather than nothing. Hiding what the user
   * needs is worse than showing a path that might not resolve, and the
   * validator catches the real mismatch at publish.
   */
  const subject = useMemo<SubjectType | null>(() => {
    const provided = new Set<SubjectType>();
    for (const candidate of nodes) {
      const def = getDefinition(candidate.nodeType);
      if (!def || def.category !== "trigger") continue;
      const subjects = subjectsProvidedBy(def, candidate.nodeConfig.parameters ?? {});
      if (!subjects) return null;
      for (const s of subjects) provided.add(s);
    }
    return provided.size === 1 ? [...provided][0] : null;
  }, [nodes]);

  const [draftLabel, setDraftLabel] = useState("");
  useEffect(() => setDraftLabel(node?.nodeConfig.label ?? ""), [node?.id, node?.nodeConfig.label]);

  const open = !!node && !!definition;

  const panel = useResizablePanel({
    storageKey: "zaxvio-automation-config-width",
    defaultWidth: 380,
    // Below ~320 the two-column field rows collapse and long variable tokens
    // like `{{job.scheduledDate}}` stop being readable at all.
    minWidth: 320,
    maxWidth: 720,
    side: "right",
  });

  return (
    <aside
      aria-hidden={!open}
      style={{ width: open ? panel.width : 0 }}
      className={cn(
        "relative flex shrink-0 flex-col overflow-hidden border-l border-border bg-card",
        // The open/close animation is suppressed **while dragging** — a width
        // transition during a drag lags the pointer by its own duration, which
        // feels like the panel is resisting. Also suppressed until mounted, so
        // the saved width does not visibly animate in from the default.
        panel.isResizing || !panel.mounted
          ? ""
          : "transition-[width] duration-200 ease-out motion-reduce:transition-none",
        !open && "border-l-0",
      )}
    >
      {/* The drag handle. Sits over the border it appears to be, 6px wide for
          a real target, and shows itself on hover rather than drawing a
          permanent seam down the panel. Double-click restores the default. */}
      {open && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize settings panel"
          onPointerDown={panel.startResize}
          onDoubleClick={panel.reset}
          title="Drag to resize · double-click to reset"
          // Kept fully INSIDE the panel: the shell is `overflow-hidden` so it
          // can collapse to zero width, and a handle centred on the border
          // would have half its grab area clipped away.
          className="group absolute inset-y-0 left-0 z-20 w-2 cursor-col-resize"
        >
          <span
            className={cn(
              "absolute inset-y-0 left-0 w-0.5 transition-colors",
              panel.isResizing ? "bg-brand" : "bg-transparent group-hover:bg-brand/40",
            )}
          />
        </div>
      )}

      {node && definition && (
        <div
          style={{ width: panel.width }}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <Header
            label={draftLabel}
            onLabelChange={setDraftLabel}
            onLabelCommit={() => {
              const trimmed = draftLabel.trim();
              if (!trimmed || trimmed === node.nodeConfig.label) {
                setDraftLabel(node.nodeConfig.label);
                return;
              }
              renameNode(node.id, trimmed);
            }}
            typeName={definition.displayName}
            icon={definition.icon}
            color={resolveNodeColor(definition)}
            disabled={node.nodeConfig.disabled ?? false}
            readOnly={readOnly}
            onClose={() => select(null)}
            onToggleDisabled={() => toggleDisabled(node.id)}
            onDelete={() => deleteNode(node.id)}
            missingCount={
              getMissingRequiredFields(definition, node.nodeConfig.parameters ?? {}).length
            }
          />

          <div className="flex-1 overflow-y-auto">
            {/* C-7: users open a step's settings not knowing what the step
                does. One or two sentences fixes that for the price of a string
                already sitting in the definition. */}
            {definition.howItWorks && (
              <p className="border-b border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground font-body">
                {definition.howItWorks}
              </p>
            )}

            {contextQuery.isLoading ? (
              <div className="space-y-4 px-4 py-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <ConfigRenderer
                definition={definition}
                parameters={node.nodeConfig.parameters ?? {}}
                onChange={(field, value) => setNodeParameter(node.id, field, value)}
                nodeId={node.id}
                disabled={readOnly || node.nodeConfig.disabled}
                context={context}
                contextLoading={contextQuery.isLoading}
                subject={subject}
              />
            )}

            {node.nodeConfig.disabled && (
              <p className="mx-4 mb-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs leading-snug text-muted-foreground font-body">
                This step is switched off, so its settings can&rsquo;t be changed.
                Switch it back on to edit them.
              </p>
            )}

            {/* C-6. Not offered on a trigger: a trigger has no settings to
                resolve against a record — it *is* the thing that supplies the
                record — so the button would return its own inputs back. */}
            {definition.category !== "trigger" && (
              <NodePreviewPanel
                workflowId={workflowId}
                nodeId={node.id}
                disabled={readOnly}
              />
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function Header({
  label,
  onLabelChange,
  onLabelCommit,
  typeName,
  icon,
  color,
  disabled,
  readOnly,
  onClose,
  onToggleDisabled,
  onDelete,
  missingCount,
}: {
  label: string;
  onLabelChange: (value: string) => void;
  onLabelCommit: () => void;
  typeName: string;
  icon: string;
  color: string;
  disabled: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onToggleDisabled: () => void;
  onDelete: () => void;
  missingCount: number;
}) {
  const Icon = resolveNodeIcon(icon);

  return (
    <div className="border-b border-border">
      <div className="flex items-start gap-2.5 px-4 py-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}22`, color }}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>

        <div className="min-w-0 flex-1">
          {/* Renaming happens here, in place. "Text the customer" is what the
              user calls this step; the type below it never changes. */}
          <Input
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            onBlur={onLabelCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            disabled={readOnly}
            maxLength={120}
            aria-label="Step name"
            className="h-auto border-transparent bg-transparent px-1 py-0.5 font-heading text-sm font-semibold hover:border-border focus:border-input focus:bg-background"
          />
          <p className="px-1 text-[11px] text-muted-foreground font-body">{typeName}</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="-mr-1 -mt-1 h-7 w-7 shrink-0"
          onClick={onClose}
          aria-label="Close settings"
        >
          <IconX className="h-4 w-4" />
        </Button>
      </div>

      {missingCount > 0 && !disabled && (
        <p className="flex items-center gap-1.5 border-t border-border bg-amber-500/10 px-4 py-2 text-xs text-amber-700 font-body dark:text-amber-400">
          <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {missingCount} {missingCount === 1 ? "field" : "fields"} still needed before
          you can publish
        </p>
      )}

      {!readOnly && (
        <div className="flex items-center gap-1 border-t border-border px-3 py-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground font-body"
                onClick={onToggleDisabled}
              >
                {disabled ? (
                  <IconEye className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <IconEyeOff className="mr-1.5 h-3.5 w-3.5" />
                )}
                {disabled ? "Switch on" : "Switch off"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Skip this step without deleting it — the usual way to narrow down
              what an automation is doing
            </TooltipContent>
          </Tooltip>

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2 text-xs text-destructive font-body hover:text-destructive"
            onClick={onDelete}
          >
            <IconTrash className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
