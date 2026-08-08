"use client";

import Link from "next/link";
import {
  IconDotsVertical,
  IconArchive,
  IconPencil,
  IconBolt,
} from "@tabler/icons-react";
import { getEventDefinition } from "@hvac-saas/workflow-nodes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { WorkflowListItem } from "@/actions/workflows";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The automations list.
 *
 * ## It is an index, not a directory
 *
 * A column of names answers "what have I made" and nothing else — and the
 * answer people actually need from this page is *what does each one do*, which
 * with six automations they otherwise get by opening all six. So every row
 * carries **what starts it** and **how many steps it has**, resolved from the
 * published version's `trigger_types` and `node_count`. Both were already
 * denormalised onto that row for other reasons, so it costs one join.
 *
 * The other column that carries weight is **State**, and it is why this is a
 * table rather than cards. Three states must be distinguishable at a glance and
 * two of them look like "working" if you are careless:
 *
 *   Live   — published and switched on. It is running.
 *   Off    — published and switched off. It will not run.
 *   Draft  — never published. It *cannot* run, and the toggle is disabled.
 *
 * The failure that guards against is documented: users build an automation,
 * never activate it, and report it as broken.
 */

export type AutomationRow = WorkflowListItem;

export interface AutomationsTableProps {
  workflows: AutomationRow[];
  onToggleActive: (workflow: AutomationRow, next: boolean) => void;
  onArchive: (workflow: AutomationRow) => void;
  onRename: (workflow: AutomationRow) => void;
  /** Ids with a mutation in flight — the row's toggle is held while it lands. */
  pendingIds?: Set<string>;
  archived?: boolean;
}

export function AutomationsTable({
  workflows,
  onToggleActive,
  onArchive,
  onRename,
  pendingIds,
  archived = false,
}: AutomationsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="hidden md:table-cell">What starts it</TableHead>
          <TableHead className="w-[120px]">State</TableHead>
          <TableHead className="w-[90px] hidden lg:table-cell">Version</TableHead>
          <TableHead className="w-[130px] hidden lg:table-cell">Last edited</TableHead>
          <TableHead className="w-[100px] text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workflows.map((workflow) => {
          const published = workflow.activeVersionId !== null;
          const pending = pendingIds?.has(workflow.id) ?? false;

          return (
            <TableRow key={workflow.id} className="group">
              <TableCell className="py-3">
                <Link
                  href={`/automations/${workflow.id}`}
                  className="font-medium hover:text-brand focus-visible:text-brand focus-visible:underline focus-visible:outline-none"
                >
                  {workflow.name}
                </Link>
                {workflow.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground font-body">
                    {workflow.description}
                  </p>
                )}
                {/* The trigger folds under the name below `md`, where its own
                    column is hidden — dropping the information entirely on a
                    laptop would defeat the point of showing it. */}
                <div className="mt-1 md:hidden">
                  <TriggerSummary workflow={workflow} />
                </div>
              </TableCell>

              <TableCell className="hidden md:table-cell">
                <TriggerSummary workflow={workflow} />
              </TableCell>

              <TableCell>
                <StateCell
                  published={published}
                  isActive={workflow.isActive}
                  archived={archived}
                />
              </TableCell>

              <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                {workflow.version === null ? "—" : `v${workflow.version}`}
              </TableCell>

              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground font-body">
                {/* Relative, not a calendar date: `updated_at` is a timestamptz
                    with a real instant behind it, and "7h ago" is the question
                    being asked of an edit time. */}
                {formatRelativeTime(workflow.updatedAt)}
              </TableCell>

              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {!archived && (
                    // Wrapped in a span because a disabled control fires no
                    // pointer events, so a Tooltip on the Switch itself would
                    // never open — which is exactly the case needing the
                    // explanation ("Publish first").
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Switch
                            checked={workflow.isActive}
                            disabled={!published || pending}
                            onCheckedChange={(next) => onToggleActive(workflow, next)}
                            aria-label={
                              workflow.isActive
                                ? `Switch off ${workflow.name}`
                                : `Switch on ${workflow.name}`
                            }
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {published
                          ? workflow.isActive
                            ? "Switch off"
                            : "Switch on"
                          : "Publish this automation before switching it on"}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <IconDotsVertical className="h-4 w-4" />
                        <span className="sr-only">Actions for {workflow.name}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onRename(workflow)}>
                        <IconPencil className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onArchive(workflow)}
                        className="text-destructive focus:text-destructive"
                      >
                        <IconArchive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * What sets this automation off, and how much it does.
 *
 * Resolved from the *published* version, so it describes what is actually live
 * rather than what someone has half-drawn since. A draft says so plainly rather
 * than showing an em-dash, because "—" reads as missing data when the real
 * answer is "this has never been published".
 */
function TriggerSummary({ workflow }: { workflow: AutomationRow }) {
  if (workflow.activeVersionId === null) {
    return (
      <span className="text-xs text-muted-foreground font-body">
        Not published yet
      </span>
    );
  }

  const events = workflow.triggerTypes ?? [];
  const names = events
    .map((event) => getEventDefinition(event)?.label)
    .filter((label): label is string => !!label);

  const steps = workflow.nodeCount ?? 0;

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-body">
      <IconBolt className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
      <span className="truncate">
        {names.length === 0
          ? "Run by hand"
          : names.length <= 2
            ? names.join(" or ")
            : `${names.slice(0, 2).join(", ")} +${names.length - 2}`}
      </span>
      <span className="shrink-0 text-muted-foreground/60">
        · {steps} {steps === 1 ? "step" : "steps"}
      </span>
    </span>
  );
}

/**
 * The four states, drawn as one system.
 *
 * Shape carries the meaning, not colour alone, so it survives greyscale, a
 * projector and colour blindness:
 *
 *   Live      ● filled     it is running
 *   Off       ○ hollow     published, switched off
 *   Draft     ◌ dashed     never published — it cannot run
 *   Archived  – rule       put away
 *
 * The dashed ring for Draft does real work: "not finished" is what a dashed
 * outline means everywhere else in this app.
 */
function StateCell({
  published,
  isActive,
  archived,
}: {
  published: boolean;
  isActive: boolean;
  archived: boolean;
}) {
  const state = archived
    ? ({ label: "Archived", muted: true } as const)
    : !published
      ? ({ label: "Draft", muted: true } as const)
      : isActive
        ? ({ label: "Live", muted: false } as const)
        : ({ label: "Off", muted: true } as const);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-sm font-body",
        state.muted && "text-muted-foreground",
      )}
    >
      <span aria-hidden className="flex h-2.5 w-2.5 items-center justify-center">
        {archived ? (
          <span className="h-px w-2.5 bg-muted-foreground/50" />
        ) : !published ? (
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground/70" />
        ) : isActive ? (
          <span className="h-2 w-2 rounded-full bg-green-500" />
        ) : (
          <span className="h-2 w-2 rounded-full border border-muted-foreground/60" />
        )}
      </span>
      {state.label}
    </span>
  );
}
