"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { BuilderToolbar } from "@/components/dashboard/automations/builder/builder-toolbar";
import { NodePalettePanel } from "@/components/dashboard/automations/builder/node-palette-panel";
import { ConfigPanel } from "@/components/dashboard/automations/builder/config/config-panel";
import { BranchDeleteDialog } from "@/components/dashboard/automations/builder/branch-delete-dialog";
import { AutomationValidationDialog } from "@/components/dashboard/automations/automation-validation-dialog";
import {
  useWorkflow,
  usePublishWorkflow,
  useSaveWorkflowGraph,
  useSetWorkflowActive,
  useUpdateWorkflow,
  useRunWorkflow,
} from "@/hooks/queries";
import { useBuilderStore } from "@/lib/workflow/store";
import type { WorkflowDetail, WorkflowValidation } from "@/actions/workflows";

/**
 * P-7: React Flow measures the DOM on mount and has no server render worth
 * having. Importing it statically also drags the whole canvas bundle into the
 * dashboard's shared chunk, where every other page pays for it.
 */
const AutomationCanvas = dynamic(
  () =>
    import("@/components/dashboard/automations/builder/automation-canvas").then(
      (m) => m.AutomationCanvas,
    ),
  {
    ssr: false,
    // P-6: a skeleton, never a spinner — the repo convention, and it holds the
    // canvas's space so the toolbar does not jump when it arrives.
    loading: () => <Skeleton className="h-full w-full rounded-none" />,
  },
);

interface Props {
  id: string;
  initialDetail: WorkflowDetail | null;
  initialError: string | null;
}

export function AutomationDetailPageClient({ id, initialDetail, initialError }: Props) {
  const query = useWorkflow(id);
  const saveMutation = useSaveWorkflowGraph();
  const updateMutation = useUpdateWorkflow();
  const publishMutation = usePublishWorkflow();
  const activeMutation = useSetWorkflowActive();
  const runMutation = useRunWorkflow();

  const [validation, setValidation] = useState<WorkflowValidation | null>(null);

  const detail = query.data?.data ?? initialDetail;
  const loadError = query.isError
    ? "Couldn't reach the server."
    : (query.data?.error ?? (detail ? null : initialError));

  const load = useBuilderStore((s) => s.load);
  const markSaved = useBuilderStore((s) => s.markSaved);
  const select = useBuilderStore((s) => s.select);
  const localDirty = useBuilderStore((s) => s.dirty);

  /**
   * The optimistic-concurrency token.
   *
   * Held in a ref, not state: it must be readable by the save handler without
   * that handler being re-created, and re-rendering when it changes would be
   * pointless — nothing displays it. It is seeded from the load and replaced
   * with whatever the server returns, so the value sent back is always the exact
   * value stored. Anything else is a 409 on the user's very next save.
   */
  const tokenRef = useRef<string | null>(null);

  /**
   * Load the graph into the store **once per workflow**.
   *
   * Keyed on the id rather than on `detail`, because a background refetch
   * returning an identical payload would otherwise reset the store and discard
   * whatever the user had drawn since. That is the single most damaging thing a
   * builder can do, and it happens silently.
   */
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!detail || loadedFor.current === id) return;
    loadedFor.current = id;
    tokenRef.current = detail.workflow.updatedAt;
    load(detail.graph);
  }, [detail, id, load]);

  // Warn before leaving with unsaved work. The graph lives only in memory until
  // Save, so a closed tab loses it outright.
  useEffect(() => {
    if (!localDirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [localDirty]);

  if (loadError || !detail) {
    return (
      <section className="p-6">
        <LoadErrorState
          title="Couldn't load this automation"
          message={loadError}
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      </section>
    );
  }

  const { workflow, activeVersion, isDirty } = detail;
  const published = activeVersion !== null;

  /**
   * Persist the draft. Returns whether it landed, so Publish can wait on it.
   *
   * A 409 or a transport failure resolves `false` — both already toast inside
   * the hook, so callers only need to know not to carry on.
   */
  async function saveGraph(): Promise<boolean> {
    const graph = useBuilderStore.getState().toGraph();
    const expectedUpdatedAt = tokenRef.current;
    if (!expectedUpdatedAt) return false;

    try {
      const res = await saveMutation.mutateAsync({
        id,
        data: { ...graph, expectedUpdatedAt },
      });
      if (res.error || !res.data) return false;
      tokenRef.current = res.data.updatedAt;
      markSaved();
      return true;
    } catch {
      return false;
    }
  }

  function handleSave() {
    void saveGraph();
  }

  /**
   * Publish **saves first** when there are unsaved edits.
   *
   * The server validates the graph it loads from the database, not the one on
   * screen — which is right, because a publish that trusted a client's claim of
   * validity would publish whatever the client said. But it made Publish lie:
   * adding a trigger and pressing Publish without saving reported "Nothing
   * starts this automation", which was true of the stored draft and obviously
   * false to the person looking at the trigger they had just placed.
   *
   * Pressing Publish means "make what I am looking at live". So it saves, and
   * only publishes if that succeeded — a failed save (a 409, say) must not be
   * followed by publishing someone else's graph.
   */
  async function handlePublish() {
    if (useBuilderStore.getState().dirty) {
      const saved = await saveGraph();
      if (!saved) return;
    }

    publishMutation.mutate(
      { id, note: null },
      {
        onSuccess: (res) => {
          // A refused publish is the product working. The problems go into a
          // dialog the user can read and click through, not a toast.
          if (res.status === "invalid") setValidation(res.validation);
        },
      },
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      {/* Fills the dashboard viewport: a graph editor inside a scrolling page
          is two competing scroll contexts, and the canvas loses.

          `3.5rem` is the navbar's real height (`h-14`) — it was `4rem`, which
          left the builder 8px short of the fold. `dvh` rather than `vh` so a
          mobile browser's collapsing address bar does not clip the toolbar.
          `data-fills-viewport` is what tells the page to stop scrolling. */}
      <section
        data-fills-viewport
        className="flex h-[calc(100dvh-3.5rem)] flex-col"
      >
        <BuilderToolbar
          id={id}
          name={workflow.name}
          publishedVersion={activeVersion?.version ?? null}
          isActive={workflow.isActive}
          serverDirty={isDirty}
          onSave={handleSave}
          onPublish={() => void handlePublish()}
          onToggleActive={(next) => activeMutation.mutate({ id, isActive: next })}
          onRun={() => runMutation.mutate({ id })}
          onRename={(next) => updateMutation.mutate({ id, data: { name: next } })}
          saving={saveMutation.isPending}
          // Publish now saves first, so the button has to stay busy for both
          // halves — otherwise it goes idle mid-sequence and invites a second
          // click that would publish twice.
          publishing={publishMutation.isPending || saveMutation.isPending}
          togglingActive={activeMutation.isPending}
          running={runMutation.isPending}
        />

        {/* S-5: an automation that is published and switched off must say so
            unmissably. Users build one, never activate it, and report it as
            broken — the banner is the fix, not a safer default. */}
        {published && !workflow.isActive && (
          <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2">
            <p className="text-sm font-body">
              <strong className="font-medium">This automation is off.</strong> It
              will not run until you switch it on.
            </p>
          </div>
        )}

        {/* §8.12: below 768px the builder is view-only. A node-graph editor on a
            phone is a bad experience users blame on the product, so it is not
            offered — but the graph is still readable, which is what someone on a
            phone actually wants. */}
        <div className="border-b border-border bg-muted/40 px-4 py-2 md:hidden">
          <p className="text-xs text-muted-foreground font-body">
            Open this on a larger screen to edit. You can still publish, run it
            and switch it on here.
          </p>
        </div>

        {/* The palette is a column beside the canvas, not an overlay on top of
            it — so the step you just added stays visible while you pick the
            next. It is deliberately outside the dynamic import: it does not
            touch React Flow, so it can render immediately while the canvas
            bundle is still arriving. */}
        <div className="flex min-h-0 flex-1">
          <NodePalettePanel />
          <div className="min-w-0 flex-1">
            <AutomationCanvas />
          </div>
          <ConfigPanel workflowId={id} />
        </div>

        {/* X-4. Rendered once here rather than in the two places that delete —
            the config panel's button and the canvas's Delete key both route
            through the store, so neither can sever branches silently. */}
        <BranchDeleteDialog />

        <AutomationValidationDialog
          validation={validation}
          open={validation !== null}
          onOpenChange={(open) => {
            if (!open) setValidation(null);
          }}
          // S-4: clicking an error selects the step it is about. A list of
          // errors you cannot navigate to is barely better than no list.
          onSelectNode={(nodeId) => select(nodeId)}
        />
      </section>
    </TooltipProvider>
  );
}
