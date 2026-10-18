"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
import { useReplayOnChange } from "@/hooks/use-replay-on-change";
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
 *
 * ## Below `md` the graph is view-only
 *
 * Undo, redo and Save go (`max-md:hidden`, in CSS, not on `readOnly`: that
 * arrives a render after hydration and a wide screen would see the editing
 * controls pop in). What stays is what works on a graph nobody can change:
 * history, versions, Run once, the on/off switch and Publish. Publish stays on
 * purpose: it changes nothing in the graph, it puts live a draft that was
 * finished on a laptop, and doing that from the job site is the point of
 * having the page on a phone at all.
 *
 * The width budget is deliberate. The sidebar takes 224px from `lg`, so a 1024px
 * window has an 800px builder: one row there (and at 768px) needs the back link
 * and Run once to be icon-only until `xl`, and "Unpublished changes" to shrink
 * to its dot. A row that wraps costs the canvas a second toolbar of height.
 */

/** Grows a 20px switch's hit area to 40px on a phone without growing the switch. */
const SWITCH_TOUCH =
  "relative before:absolute before:-inset-x-1 before:-inset-y-2.5 sm:before:hidden";

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
  /** The graph cannot be edited here, so the name is shown rather than offered. */
  readOnly?: boolean;
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
  readOnly = false,
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

  // Publishing is the moment worth marking: "Draft" becomes "v1", or "v3"
  // becomes "v4", and the chip pops as it does. `?? 0` so the first publish
  // (null to 1) counts as a change rather than as a value arriving.
  const versionChipRef = useRef<HTMLSpanElement>(null);
  useReplayOnChange(versionChipRef, publishedVersion ?? 0, "motion-pop");

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="font-body -ml-2 h-10 sm:h-8"
      >
        {/* Named for assistive tech because the word is hidden until `xl`. */}
        <Link href="/automations" aria-label="Automations" title="Automations">
          <IconArrowLeft className="h-4 w-4 xl:mr-1.5" />
          <span className="hidden xl:inline">Automations</span>
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
        readOnly={readOnly}
        aria-label="Automation name"
        placeholder={DEFAULT_WORKFLOW_NAME}
        className={cn(
          // On a phone the name takes whatever the row has left (the actions
          // wrap beneath it), and is 16px so iOS does not zoom the page when it
          // is tapped. From `sm` it goes back to its content-sized field.
          "min-w-[9rem] max-w-none flex-1 rounded border border-transparent bg-transparent px-1.5 py-0.5",
          "font-heading text-base font-semibold outline-none transition-colors",
          "sm:min-w-0 sm:max-w-[36ch] sm:flex-none sm:text-sm",
          !readOnly && "hover:border-border focus:border-input focus:bg-background",
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
      <span ref={versionChipRef} className="inline-flex">
        {published ? (
          <span className="inline-flex items-center gap-2 text-sm font-body">
            <span
              aria-hidden
              className={
                isActive
                  ? "h-2 w-2 shrink-0 rounded-full bg-green-500 transition-colors duration-200"
                  : "h-2 w-2 shrink-0 rounded-full border border-muted-foreground/60 transition-colors duration-200"
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
      </span>

      {unpublished && published && (
        // The words give way to the dot from `md` to `xl`, where the editing
        // controls are back and the row has no room for them; `title` names it
        // for a pointer. Phones have the room (the row wraps), so they keep it.
        <span
          className="motion-appear inline-flex items-center gap-1.5 text-xs text-muted-foreground font-body"
          title="Unpublished changes"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
          <span className="md:max-xl:sr-only">Unpublished changes</span>
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        {/* Undo and redo go with the other editing controls below `md`. On the
            wrapper rather than the button: the tooltip trigger is what owns the
            layout box. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex max-md:hidden">
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
            <span className="inline-flex max-md:hidden">
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
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="ml-1 h-10 w-10 sm:h-8 sm:w-8"
            >
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
                className="h-10 w-10 sm:h-8 sm:w-8"
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

        {/* Icon-only until `xl` (the word costs 60px an 800px row does not
            have), so it carries its own name. */}
        <Button
          variant="outline"
          size="sm"
          className="h-10 font-body sm:h-8"
          disabled={!published || running}
          onClick={onRun}
          aria-label="Run once"
          title="Run once"
        >
          <IconPlayerPlay className="h-3.5 w-3.5 xl:mr-1.5" />
          <span className="hidden xl:inline">Run once</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="font-body max-md:hidden"
          disabled={!localDirty || saving}
          onClick={onSave}
        >
          {saving ? "Saving…" : localDirty ? "Save" : "Saved"}
        </Button>

        <Button
          size="sm"
          className="bg-brand text-brand-foreground hover:bg-brand/90 font-body max-md:h-10"
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
                  className={SWITCH_TOUCH}
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
