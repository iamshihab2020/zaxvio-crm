"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  IconArrowLeft,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconAlertTriangle,
  IconHistory,
  IconPlayerPlay,
  IconVersions,
} from "@tabler/icons-react";
import {
  DEFAULT_WORKFLOW_NAME,
  isNamedWorkflow,
} from "@hvac-saas/workflow-nodes";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBuilderStore } from "@/lib/workflow/store";
import { cn } from "@/lib/utils";

/**
 * The builder's top bar.
 *
 * §8.6 is the piece of UX that D-06 obliges — drawing is not publishing — and
 * it has to be unmissable. Three separate things are shown because they are
 * three separate facts a user confuses constantly:
 *
 *   dirty      — the draft differs from what is published
 *   published  — there IS something published
 *   active     — the published thing is switched on
 *
 * An automation can be published and off, or edited and live-on-an-old-version.
 * Collapsing these into one "status" is how "why isn't it running" becomes a
 * support ticket.
 */

interface Props {
  /** The automation's id — the Runs link is the only thing that needs it. */
  id: string;
  name: string;
  publishedVersion: number | null;
  isActive: boolean;
  /** Server's view — the draft differs from the published snapshot. */
  serverDirty: boolean;
  onSave: () => void;
  onPublish: () => void;
  onToggleActive: (next: boolean) => void;
  onRun: () => void;
  onOpenVersions: () => void;
  /** Called on blur/Enter, and only when the name actually changed. */
  onRename: (name: string) => void;
  saving: boolean;
  publishing: boolean;
  togglingActive: boolean;
  running: boolean;
}

export function BuilderToolbar({
  id,
  name,
  publishedVersion,
  isActive,
  serverDirty,
  onSave,
  onPublish,
  onToggleActive,
  onRun,
  onOpenVersions,
  onRename,
  saving,
  publishing,
  togglingActive,
  running,
}: Props) {
  // Local draft so typing does not fire a mutation per keystroke; committed on
  // blur or Enter, abandoned on Escape.
  const [draftName, setDraftName] = useState(name);

  // Re-sync when the server's name changes underneath — a rename from the list
  // page in another tab, or the refetch after a save.
  useEffect(() => setDraftName(name), [name]);

  function commitName() {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setDraftName(name);        // an empty name is not a rename, it is a slip
      return;
    }
    if (trimmed === name) return;
    onRename(trimmed);
  }

  // Unsaved edits in this tab, which is a different thing from the server's
  // draft-vs-published difference. Both mean "not live", for different reasons.
  const localDirty = useBuilderStore((s) => s.dirty);
  const undo = useBuilderStore((s) => s.undo);
  const redo = useBuilderStore((s) => s.redo);
  const canUndo = useBuilderStore((s) => s.past.length > 0);
  const canRedo = useBuilderStore((s) => s.future.length > 0);

  const published = publishedVersion !== null;
  const unpublished = localDirty || serverDirty;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5">
      <Button asChild variant="ghost" size="sm" className="font-body -ml-2">
        <Link href="/automations">
          <IconArrowLeft className="mr-1.5 h-4 w-4" />
          <span className="hidden sm:inline">Automations</span>
        </Link>
      </Button>

      {/* F-1: the name is edited here, in place, not asked for in a dialog
          before the automation exists. Naming a thing you have not built yet is
          the least answerable question you can be put first — so the builder
          opens on a placeholder and this is where it gets resolved.

          An input styled as text rather than a click-to-edit toggle: the extra
          click buys nothing, and a field that only reveals itself on hover is
          invisible to anyone who does not hover. */}
      <input
        value={draftName}
        onChange={(event) => setDraftName(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraftName(name);
            event.currentTarget.blur();
          }
        }}
        maxLength={120}
        aria-label="Automation name"
        placeholder={DEFAULT_WORKFLOW_NAME}
        className={cn(
          "min-w-0 max-w-[22ch] rounded border border-transparent bg-transparent px-1.5 py-0.5",
          "font-heading text-sm font-semibold outline-none transition-colors",
          "hover:border-border focus:border-input focus:bg-background sm:max-w-[36ch]",
          // Unnamed is a state worth seeing before Publish refuses. Amber, not
          // red: nothing is wrong yet.
          !isNamedWorkflow(draftName) && "text-muted-foreground",
        )}
      />

      {!isNamedWorkflow(draftName) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-amber-500">
              <IconAlertTriangle className="h-3.5 w-3.5" />
              <span className="sr-only">This automation still needs a name</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Name this before publishing — you&rsquo;ll need to recognise it later
          </TooltipContent>
        </Tooltip>
      )}

      {/* The same marker vocabulary the list uses, so a state is one thing in
          this product rather than a badge here and a dashed ring there:
          filled = live, hollow = published but off, dashed = never published.
          The version is set in mono because it is an identifier, not a word. */}
      {published ? (
        <span className="inline-flex items-center gap-2 text-sm font-body">
          <span
            aria-hidden
            className={
              isActive
                ? "h-2 w-2 shrink-0 rounded-full bg-green-500"
                : "h-2 w-2 shrink-0 rounded-full border border-muted-foreground/60"
            }
          />
          <span className="font-mono text-xs text-muted-foreground">
            v{publishedVersion}
          </span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground font-body">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-full border border-dashed border-muted-foreground/70"
          />
          Draft
        </span>
      )}

      {unpublished && published && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-body">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
          Unpublished changes
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!canUndo}
                onClick={undo}
                aria-label="Undo"
              >
                <IconArrowBackUp className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!canRedo}
                onClick={redo}
                aria-label="Redo"
              >
                <IconArrowForwardUp className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>

        {/* Sits immediately beside Run, because it is the other half of the
            same action: pressing Run and having nowhere to see the result was
            the state this feature shipped in until the run history existed. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className="ml-1 h-8 w-8">
              <Link href={`/automations/${id}/runs`} aria-label="Run history">
                <IconHistory className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Run history</TooltipContent>
        </Tooltip>

        {/* Next to it, because both answer "what happened" — one about what the
            automation did, one about what it was. Disabled until there is a
            published version, since history of nothing is an empty sheet. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!published}
                onClick={onOpenVersions}
                aria-label="Version history"
              >
                <IconVersions className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {published ? "Version history" : "Publish once to start a history"}
          </TooltipContent>
        </Tooltip>

        <Button
          variant="outline"
          size="sm"
          className="font-body"
          disabled={!published || running}
          onClick={onRun}
        >
          <IconPlayerPlay className="mr-1.5 h-3.5 w-3.5" />
          <span className="hidden sm:inline">Run once</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="font-body"
          disabled={!localDirty || saving}
          onClick={onSave}
        >
          {saving ? "Saving…" : localDirty ? "Save" : "Saved"}
        </Button>

        <Button
          size="sm"
          className="bg-brand text-brand-foreground hover:bg-brand/90 font-body"
          disabled={publishing}
          onClick={onPublish}
        >
          {publishing ? "Publishing…" : "Publish"}
        </Button>

        <div className="flex items-center gap-2 pl-2">
          <Tooltip>
            <TooltipTrigger asChild>
              {/* A disabled control fires no pointer events, so the tooltip has
                  to hang off a wrapper — and this is the case that most needs
                  explaining, because "why is this greyed out" is the question. */}
              <span className="inline-flex">
                <Switch
                  checked={isActive}
                  disabled={!published || togglingActive}
                  onCheckedChange={onToggleActive}
                  aria-label={isActive ? "Switch off" : "Switch on"}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {published
                ? isActive
                  ? "Switch off"
                  : "Switch on"
                : "Publish this automation before switching it on"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
