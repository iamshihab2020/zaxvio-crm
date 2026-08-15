"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";
import {
  TEMPLATE_CATEGORIES,
  WORKFLOW_TEMPLATES,
  getDefinition,
  type TemplateCategory,
  type WorkflowTemplate,
} from "@hvac-saas/workflow-nodes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWorkflows } from "@/hooks/queries";
import { resolveNodeIcon } from "@/lib/workflow/icon-map";
import { cn } from "@/lib/utils";

/**
 * Pick something that already works.
 *
 * The target user is a solo contractor. "Here is a canvas and fifty kinds of
 * step" is not a feature for them — it is a project, and the honest measure of
 * this whole thing is whether somebody gets a working automation before they get
 * bored. So a ready-made one is what the dialog opens on, and the blank canvas
 * is a peer beside it rather than a footer link.
 *
 * ## Index and sheet
 *
 * This was a single scrolling column of cards, each carrying its full
 * description — which meant two and a half templates fit on screen and choosing
 * between ten of them was an act of endurance. It is now an **index** and a
 * **sheet**: every template is one scannable line on the left, and the one you
 * are looking at opens on the right with room for the prose it always had.
 *
 * The sheet is the product's own motif — field service runs on ruled paper, and
 * an automation is a standing work order. The steps are ruled rows read off the
 * template's own nodes, so a template that changes cannot end up with a card
 * that lies about it. Triggers carry the brand tile and actions a muted one, the
 * same distinction the builder canvas draws.
 *
 * ## Start from blank is an option, not an escape hatch
 *
 * It is the first row of the index, pinned above the scroll, and the only dashed
 * thing in the dialog — an empty sheet on the pad. Selecting it opens a real
 * sheet of its own explaining what you are taking on, rather than dropping you
 * straight onto an empty grid. It is *visible* first and *chosen* second, which
 * is the balance the feature needs: templates carry the adoption, but nobody
 * should have to hunt for the way past them.
 *
 * ## No category filter
 *
 * There was one. The index groups by the same categories instead, which shows
 * every shelf and its contents at once — a filter that usually resolves to one
 * to four rows is a click charged for information the list can just display.
 */

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  "getting-paid": "Getting paid",
  "winning-work": "Winning work",
  "keeping-customers": "Keeping customers",
  "staying-on-top": "Staying on top",
};

/** The index selection when nothing ready-made is chosen. */
const BLANK = "__blank__";

/**
 * What building one yourself involves.
 *
 * Numbered, unlike a template's steps: those can branch, this genuinely is a
 * sequence, and the order is the information.
 */
const BLANK_STEPS = [
  {
    title: "Pick what starts it",
    body: "A job is completed, an invoice goes overdue, somebody books through your website.",
  },
  {
    title: "Add the steps",
    body: "Send an email, wait a few days, check a condition first, notify your team.",
  },
  {
    title: "Publish and switch it on",
    body: "Nothing runs until you do — and you can watch every run afterwards.",
  },
];

/**
 * How many automations to look through for "already added".
 *
 * The gallery asks its own question rather than being handed the page the list
 * happened to be showing — that page is filtered and paginated, so searching
 * "review" and then opening this would have reported almost every template as
 * not installed. Same defect as a stats row computed from twenty rows.
 *
 * Bounded, and honestly so: a tenant with more than 100 automations may see a
 * template reported as new when they have it. That is a missing badge, not a
 * wrong one, and 100 is far past where this audience lands.
 */
const SCAN_LIMIT = 100;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: (template: WorkflowTemplate) => void;
  onStartBlank: () => void;
  pending: boolean;
}

export function TemplateGallery({
  open,
  onOpenChange,
  onUse,
  onStartBlank,
  pending,
}: Props) {
  // Opens on a real automation, never on the blank sheet: the first thing the
  // dialog says should be "here is one that works", not "here is some work".
  const [selected, setSelected] = useState<string>(
    WORKFLOW_TEMPLATES[0]?.id ?? BLANK,
  );

  // Below `md` the two panes cannot sit side by side, so the index drills
  // through to the sheet and back. Above it this is ignored entirely.
  const [drilled, setDrilled] = useState(false);

  // Mounted only while open (see the call site), so this fires when the gallery
  // is opened rather than on every visit to the automations page. TanStack
  // caches it, so a second open is instant.
  const installedQuery = useWorkflows({ page: 1, limit: SCAN_LIMIT });

  const installed = new Set(
    (installedQuery.data?.data ?? [])
      .map((workflow) => workflow.templateKey)
      .filter((key): key is string => Boolean(key)),
  );

  // Grouped in the package's declared category order rather than in one this
  // file keeps — a category added there would otherwise be dropped silently.
  // Empty shelves are omitted; a heading over nothing is a dead end.
  const groups = useMemo(
    () =>
      TEMPLATE_CATEGORIES.map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        templates: WORKFLOW_TEMPLATES.filter((t) => t.category === category),
      })).filter((group) => group.templates.length > 0),
    [],
  );

  // Null *is* the blank sheet, including when a selection cannot be resolved —
  // which is the safe direction: an unknown id opens the blank canvas rather
  // than a half-rendered template.
  const template = WORKFLOW_TEMPLATES.find((t) => t.id === selected) ?? null;

  // Derived here rather than inline so the null check narrows once. The button
  // is the thing that now creates a record, so it says which of the two it is
  // doing while it does it.
  const action = template
    ? {
        label: installed.has(template.id) ? "Add again" : "Use this template",
        busyLabel: "Adding…",
        note: "Every step can be changed after you add it.",
        run: () => onUse(template),
      }
    : {
        label: "Start from blank",
        busyLabel: "Creating…",
        note: "You'll pick what starts it first.",
        run: onStartBlank,
      };

  function choose(id: string) {
    setSelected(id);
    setDrilled(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex h-[85dvh] max-h-[44rem] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        onOpenAutoFocus={(event) => {
          // Radix focuses the first tabbable control, which here is "Start from
          // blank" — a focus ring sitting on the blank option while the sheet
          // beside it shows a template invites an Enter press that creates the
          // wrong thing. Focus the dialog itself instead: the title and
          // description are announced, and Tab still walks into the index.
          event.preventDefault();
          if (event.currentTarget instanceof HTMLElement) {
            event.currentTarget.focus();
          }
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12 text-left">
          <DialogTitle className="font-heading">New automation</DialogTitle>
          <DialogDescription className="font-body">
            Pick one that already works, or start from blank. Nothing sends until
            you publish it and switch it on.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 md:grid-cols-[17.5rem_minmax(0,1fr)]">
          {/* ── Index ─────────────────────────────────────────────── */}
          <div
            className={cn(
              "min-h-0 flex-col border-border md:flex md:border-r",
              drilled ? "hidden" : "flex",
            )}
          >
            {/* Pinned above the scroll, so the way past the templates is on
                screen no matter how far down the list you are. */}
            <div className="shrink-0 px-3 pt-3">
              <button
                type="button"
                onClick={() => choose(BLANK)}
                aria-current={template === null ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  // Brand-tinted even at rest, so it reads as an offered choice
                  // rather than as the row you have not picked. Dashed, and the
                  // only dashed thing here: an empty sheet on the pad.
                  template === null
                    ? "border-brand bg-brand/15"
                    : "border-brand/40 bg-brand/[0.07] hover:border-brand/70 hover:bg-brand/[0.12]",
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-brand/50 text-brand">
                  <IconPlus className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-sm font-semibold">
                    Start from blank
                  </span>
                  <span className="block truncate font-body text-xs text-muted-foreground">
                    Build it yourself, step by step
                  </span>
                </span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {groups.map((group) => (
                <div key={group.category}>
                  <p className="sticky top-0 z-10 bg-background px-1 pb-1.5 pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.templates.map((item) => (
                      <IndexRow
                        key={item.id}
                        template={item}
                        selected={item.id === selected}
                        installed={installed.has(item.id)}
                        onSelect={() => choose(item.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Sheet ─────────────────────────────────────────────── */}
          <div
            className={cn(
              "min-h-0 flex-col bg-card md:flex",
              drilled ? "flex" : "hidden",
            )}
          >
            <div
              // Remounts on selection, which both restarts the entrance and —
              // more importantly — resets this pane's scroll to the top. Moving
              // to a new template while parked at the bottom of a long one
              // otherwise opens it half-read.
              key={selected}
              className="min-h-0 flex-1 overflow-y-auto animate-panel-item-right px-5 py-5 sm:px-6"
            >
              <button
                type="button"
                onClick={() => setDrilled(false)}
                className="mb-4 -ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 font-body text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              >
                <IconArrowLeft className="h-3.5 w-3.5" />
                All automations
              </button>

              {template ? (
                <TemplateSheet
                  template={template}
                  installed={installed.has(template.id)}
                />
              ) : (
                <BlankSheet />
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-3 sm:px-6">
              <p className="font-body text-xs text-muted-foreground">
                {action.note}
              </p>
              <Button
                size="sm"
                disabled={pending}
                onClick={action.run}
                className="shrink-0 bg-brand font-body text-brand-foreground hover:bg-brand/90"
              >
                {pending ? action.busyLabel : action.label}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** One line in the index: what it is, what it does, and whether you have it. */
function IndexRow({
  template,
  selected,
  installed,
  onSelect,
}: {
  template: WorkflowTemplate;
  selected: boolean;
  installed: boolean;
  onSelect: () => void;
}) {
  const Icon = resolveNodeIcon(template.icon);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected
          ? "border-border bg-card shadow-sm"
          : "border-transparent hover:bg-muted/60",
      )}
    >
      {/* You-are-here. Sits on the edge the sheet opens from. */}
      {selected && (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand" />
      )}

      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
          selected ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-1.5">
          <span className="min-w-0 flex-1 font-heading text-[13px] font-semibold leading-snug">
            {template.name}
          </span>
          {installed && (
            <span className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400">
              <IconCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Already added</span>
            </span>
          )}
        </span>
        <span className="mt-0.5 line-clamp-2 block font-body text-xs leading-snug text-muted-foreground">
          {template.summary}
        </span>
      </span>
    </button>
  );
}

/** The opened sheet for a ready-made automation. */
function TemplateSheet({
  template,
  installed,
}: {
  template: WorkflowTemplate;
  installed: boolean;
}) {
  const Icon = resolveNodeIcon(template.icon);

  // Explicitly boolean. `a?.length || b?.length` is a *number*, and two empty
  // arrays render a literal "0" into the sheet.
  const hasNotes =
    Boolean(template.needsSetup?.length) || Boolean(template.dependsOn?.length);

  return (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-semibold">
              {template.name}
            </h2>
            {installed && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-body text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <IconCheck className="h-3 w-3" />
                Already added
              </span>
            )}
          </div>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            {template.summary}
          </p>
        </div>
      </div>

      <p className="mt-4 font-body text-sm leading-relaxed">{template.detail}</p>

      <SheetLabel className="mt-6">Steps</SheetLabel>
      <ol className="mt-2 overflow-hidden rounded-lg border border-border">
        {template.nodes.map((node, index) => {
          const definition = getDefinition(node.nodeType);
          const isTrigger = definition?.category === "trigger";
          const StepIcon = resolveNodeIcon(definition?.icon ?? "");

          return (
            <li
              key={node.key}
              className={cn(
                "flex items-center gap-3 px-3 py-2",
                index > 0 && "border-t border-border",
                // The second branch of a condition, laid out below its sibling
                // on the canvas. Indented here for the same reason.
                node.branchIndex !== undefined && "pl-8",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                  isTrigger
                    ? "bg-brand/15 text-brand"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <StepIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate font-body text-sm">
                {node.label ?? definition?.displayName ?? node.nodeType}
              </span>
              {/* The author's label says why the step is there; this says what
                  it actually is. "Gentle nudge" on its own tells you nothing. */}
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {definition?.displayName ?? node.nodeType}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Two different kinds of "not quite ready", kept apart because they need
          different actions from the user. */}
      {hasNotes && (
        <>
          <SheetLabel className="mt-6">Before it runs</SheetLabel>
          <div className="mt-2 space-y-1.5">
            {template.needsSetup?.map((item) => (
              <p
                key={item}
                className="flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/[0.07] px-2.5 py-2 font-body text-xs text-amber-700 dark:text-amber-400"
              >
                <IconAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>You&apos;ll need to finish: {item}</span>
              </p>
            ))}
            {template.dependsOn?.map((item) => (
              <p
                key={item}
                className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2 font-body text-xs text-muted-foreground"
              >
                <IconSettings className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Works best once you&apos;ve set: {item}</span>
              </p>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/**
 * The blank sheet.
 *
 * Given the same room as a template rather than being a bare button, because
 * the question it has to answer — "what am I taking on if I choose this?" — is
 * the one that sends people back to the templates, or forward with their eyes
 * open.
 */
function BlankSheet() {
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-brand/50 text-brand">
          <IconPlus className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-semibold">
            Start from blank
          </h2>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            An empty canvas, and every step the templates use.
          </p>
        </div>
      </div>

      <p className="mt-4 font-body text-sm leading-relaxed">
        Nothing is filled in for you — you choose what starts the automation and
        what happens next. Worth taking if what you want isn&apos;t on the list,
        or if you&apos;ve built one before and know the shape you want.
      </p>

      <SheetLabel className="mt-6">What you&apos;ll do</SheetLabel>
      <ol className="mt-2 overflow-hidden rounded-lg border border-border">
        {BLANK_STEPS.map((step, index) => (
          <li
            key={step.title}
            className={cn(
              "flex items-start gap-3 px-3 py-2.5",
              index > 0 && "border-t border-border",
            )}
          >
            <span className="tnum mt-px shrink-0 font-mono text-[11px] text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-body text-sm font-medium">
                {step.title}
              </span>
              <span className="mt-0.5 block font-body text-xs leading-snug text-muted-foreground">
                {step.body}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function SheetLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
