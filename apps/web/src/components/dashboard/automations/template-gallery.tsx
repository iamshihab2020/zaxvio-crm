"use client";

import { useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconSettings,
} from "@tabler/icons-react";
import {
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
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { useWorkflows } from "@/hooks/queries";
import { resolveNodeIcon } from "@/lib/workflow/icon-map";
import { cn } from "@/lib/utils";

/**
 * Pick something that already works.
 *
 * The target user is a solo contractor. "Here is a canvas and sixteen kinds of
 * step" is not a feature for them — it is a project, and the honest measure of
 * this whole thing is whether somebody gets a working automation before they get
 * bored. So the gallery is the default way in and the blank canvas is the
 * secondary one, which is the opposite of how a builder usually presents itself.
 *
 * Each card leads with the **outcome**, not the mechanism. "Three reminders —
 * gentle at 1 day, firmer at 7, direct at 14" is a thing a person wants; "an
 * automation with three overdue triggers and three email steps" is a thing a
 * person has to translate first.
 *
 * The steps are drawn from the template's own nodes rather than described in
 * prose, so a template that changes cannot end up with a card that lies about
 * it — the same reason node cards derive their summary from the definition.
 */

const CATEGORY_LABELS: Record<TemplateCategory | "all", string> = {
  all: "All",
  "getting-paid": "Getting paid",
  "winning-work": "Winning work",
  "keeping-customers": "Keeping customers",
  "staying-on-top": "Staying on top",
};

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
  const [category, setCategory] = useState<string>("all");

  // Mounted only while open (see the call site), so this fires when the gallery
  // is opened rather than on every visit to the automations page. TanStack
  // caches it, so a second open is instant.
  const installedQuery = useWorkflows({ page: 1, limit: SCAN_LIMIT });

  // Only the shelves that have something on them. A tab that filters to an
  // empty list is a dead end the user has to back out of.
  const tabs = useMemo(() => {
    const present = new Set(WORKFLOW_TEMPLATES.map((t) => t.category));
    return [
      { value: "all", label: CATEGORY_LABELS.all },
      ...(Object.keys(CATEGORY_LABELS) as (TemplateCategory | "all")[])
        .filter((key): key is TemplateCategory => key !== "all" && present.has(key))
        .map((key) => ({ value: key, label: CATEGORY_LABELS[key] })),
    ];
  }, []);

  const visible = WORKFLOW_TEMPLATES.filter(
    (template) => category === "all" || template.category === category,
  );

  const installed = new Set(
    (installedQuery.data?.data ?? [])
      .map((workflow) => workflow.templateKey)
      .filter((key): key is string => Boolean(key)),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-full flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle className="font-heading">Start with a template</DialogTitle>
          <DialogDescription className="font-body">
            Ready-made automations you can use as they are, or change to suit.
            Nothing sends until you publish it and switch it on.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border px-6 py-3">
          <StatusFilterTabs options={tabs} value={category} onChange={setCategory} />
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {visible.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              installed={installed.has(template.id)}
              onUse={() => onUse(template)}
              pending={pending}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
          <p className="text-xs text-muted-foreground font-body">
            Templates are a starting point — every step can be changed.
          </p>
          <Button variant="outline" size="sm" onClick={onStartBlank} disabled={pending}>
            Start from blank
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  installed,
  onUse,
  pending,
}: {
  template: WorkflowTemplate;
  installed: boolean;
  onUse: () => void;
  pending: boolean;
}) {
  const Icon = resolveNodeIcon(template.icon);

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-input">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-sm font-semibold">{template.name}</h3>
            {installed && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 font-body dark:text-emerald-400">
                <IconCheck className="h-3 w-3" />
                Already added
              </span>
            )}
          </div>

          <p className="mt-0.5 text-sm text-muted-foreground font-body">
            {template.summary}
          </p>
          <p className="mt-2 text-sm font-body">{template.detail}</p>

          <StepTrail template={template} />

          {/* Two different kinds of "not quite ready", kept apart because they
              need different actions from the user. */}
          {template.needsSetup?.map((item) => (
            <p
              key={item}
              className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 font-body dark:text-amber-500"
            >
              <IconAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>You&apos;ll need to finish: {item}</span>
            </p>
          ))}
          {template.dependsOn?.map((item) => (
            <p
              key={item}
              className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground font-body"
            >
              <IconSettings className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Works best once you&apos;ve set: {item}</span>
            </p>
          ))}
        </div>

        <Button size="sm" onClick={onUse} disabled={pending} className="shrink-0">
          {installed ? "Add again" : "Use this"}
        </Button>
      </div>
    </div>
  );
}

/**
 * The template's steps, read off its own nodes.
 *
 * Capped at five with a count for the rest — `chase-overdue-invoices` has seven,
 * and a card that unrolls the lot stops being scannable, which is the only job
 * a card has.
 */
function StepTrail({ template }: { template: WorkflowTemplate }) {
  const MAX = 5;
  const labels = template.nodes.map(
    (node) => node.label ?? getDefinition(node.nodeType)?.displayName ?? node.nodeType,
  );
  const shown = labels.slice(0, MAX);
  const rest = labels.length - shown.length;

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-1 gap-y-1">
      {shown.map((label, index) => (
        <span key={`${label}-${index}`} className="flex items-center gap-1">
          <span
            className={cn(
              "rounded border border-border bg-muted px-1.5 py-0.5",
              "font-mono text-[11px] leading-none text-muted-foreground",
            )}
          >
            {label}
          </span>
          {index < shown.length - 1 && (
            <IconArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          )}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-[11px] text-muted-foreground font-body">
          +{rest} more
        </span>
      )}
    </div>
  );
}
