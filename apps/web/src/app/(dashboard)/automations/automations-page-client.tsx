"use client";

import { useMemo, useState } from "react";
import { IconPlus, IconRobot } from "@tabler/icons-react";
import { DEFAULT_WORKFLOW_NAME } from "@hvac-saas/workflow-nodes";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SearchInput } from "@/components/reusable/search-input";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { EmptyState } from "@/components/reusable/empty-state";
import { TemplateGallery } from "@/components/dashboard/automations/template-gallery";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import {
  AutomationsTable,
  type AutomationRow,
} from "@/components/dashboard/automations/automations-table";
import {
  AutomationNameDialog,
  type AutomationNameValues,
} from "@/components/dashboard/automations/automation-name-dialog";
import {
  useWorkflows,
  useCreateWorkflow,
  useCreateWorkflowFromTemplate,
  useUpdateWorkflow,
  useSetWorkflowActive,
  useArchiveWorkflow,
} from "@/hooks/queries";
import { seeded } from "@/hooks/queries/seed";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "live", label: "Live" },
  { value: "off", label: "Off" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

interface AutomationsPageClientProps {
  initialWorkflows?: AutomationRow[];
  initialTotal?: number;
  initialError?: string | null;
}

export function AutomationsPageClient({
  initialWorkflows = [],
  initialTotal = 0,
  initialError = null,
}: AutomationsPageClientProps) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [renaming, setRenaming] = useState<AutomationRow | null>(null);
  const [archiving, setArchiving] = useState<AutomationRow | null>(null);

  // ── Queries ────────────────────────────────────────────────
  //
  // `live` / `off` / `draft` are *derived* states, not columns — the API knows
  // `isActive` and `archivedAt`, and "draft" is `activeVersionId IS NULL`. Only
  // what the server can filter is sent; the rest is applied below. Sending a
  // `status=draft` the API does not understand would silently return everything.
  const listParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      showArchived: statusFilter === "archived" ? true : undefined,
      isActive:
        statusFilter === "live" ? true : statusFilter === "off" ? false : undefined,
    }),
    [page, search, statusFilter],
  );

  const isFirstRender =
    page === 1 && !search && !statusFilter && initialWorkflows.length > 0;

  const workflowsQuery = useWorkflows(
    listParams,
    // ARC-06: seed ONLY the key the server actually rendered. Seeding every key
    // is the original dashboard bug — changing a filter showed stale data and
    // never refetched.
    seeded(isFirstRender, {
      data: initialWorkflows,
      error: initialError,
      status: initialError ? 500 : 200,
      notFound: false,
      pagination: {
        page: 1,
        limit: PAGE_SIZE,
        total: initialTotal,
        totalPages: Math.max(1, Math.ceil(initialTotal / PAGE_SIZE)),
      },
    }),
  );

  const workflows = workflowsQuery.data?.data ?? [];
  const pagination = workflowsQuery.data?.pagination;
  const loading = workflowsQuery.isLoading;

  // *Failed* is not *empty*. A list that renders "No automations yet" after a
  // 500 tells the user they have none — a different and worse claim than an
  // error. This is the check 17 list pages in this repo still do not have.
  const loadError = workflowsQuery.isError
    ? "Couldn't reach the server."
    : (workflowsQuery.data?.error ?? null);

  // ── Mutations ──────────────────────────────────────────────
  const createMutation = useCreateWorkflow();
  const templateMutation = useCreateWorkflowFromTemplate();
  const updateMutation = useUpdateWorkflow();
  const activeMutation = useSetWorkflowActive();
  const archiveMutation = useArchiveWorkflow();

  const pendingIds = useMemo(() => {
    const ids = new Set<string>();
    if (activeMutation.isPending && activeMutation.variables) {
      ids.add(activeMutation.variables.id);
    }
    return ids;
  }, [activeMutation.isPending, activeMutation.variables]);

  // ── Derived ────────────────────────────────────────────────
  // "draft" has no server-side filter, so it narrows what came back. That makes
  // its count page-local, which is why the pagination footer is hidden for it
  // rather than showing a total that disagrees with the rows on screen.
  const visible = useMemo(() => {
    if (statusFilter !== "draft") return workflows;
    return workflows.filter((w) => w.activeVersionId === null);
  }, [workflows, statusFilter]);

  const isFiltered = !!search || !!statusFilter;
  const showEmptyState =
    !loading && !loadError && workflows.length === 0 && !isFiltered;
  const showNoResults = !loading && !loadError && visible.length === 0 && isFiltered;

  // ── Handlers ───────────────────────────────────────────────

  /**
   * F-1: no dialog. Create the record on a placeholder name and go.
   *
   * The question a name dialog asks — "what is this automation called?" — is
   * the one question the user cannot answer yet, because they have not built
   * anything. So the builder opens on a placeholder and the name is edited in
   * the toolbar once there is something to name. Publish is what insists on a
   * real one.
   *
   * The row is still created server-side first, unlike the system this is
   * modelled on: the whole-graph save uses `updatedAt` as its concurrency
   * token, which needs a row to exist. Dropping the dialog does not require
   * dropping that.
   */
  /**
   * "New automation" opens the gallery, it does not create anything.
   *
   * The blank canvas is the secondary path on purpose. A solo contractor faced
   * with an empty grid and sixteen kinds of step does not build an automation —
   * they close the tab. Starting from something that already works is what makes
   * the difference between a feature and a demo, so it is the default, and
   * "Start from blank" is one click away for anyone who wants it.
   */
  function handleCreate() {
    setGalleryOpen(true);
  }

  function handleStartBlank() {
    createMutation.mutate(
      { name: DEFAULT_WORKFLOW_NAME },
      {
        onSuccess: (res) => {
          if (res.error || !res.data) return;
          setGalleryOpen(false);
          router.push(`/automations/${res.data.id}`);
        },
      },
    );
  }

  function handleUseTemplate(template: { id: string }) {
    templateMutation.mutate(
      { templateId: template.id },
      {
        onSuccess: (res) => {
          if (res.error || !res.data) return;
          setGalleryOpen(false);
          // Straight into the builder, on the draft. The tenant reads what it
          // will send BEFORE it can send anything — which is the whole reason
          // installing a template does not publish or switch on.
          router.push(`/automations/${res.data.id}`);
        },
      },
    );
  }

  function handleRename(values: AutomationNameValues) {
    if (!renaming) return;
    updateMutation.mutate(
      {
        id: renaming.id,
        data: { name: values.name, description: values.description || null },
      },
      {
        onSuccess: (res) => {
          if (!res.error) {
            setNameDialogOpen(false);
            setRenaming(null);
          }
        },
      },
    );
  }

  function handleArchive() {
    if (!archiving) return;
    archiveMutation.mutate(archiving.id, {
      onSuccess: (res) => {
        if (!res.error) setArchiving(null);
      },
    });
  }

  const savingName = updateMutation.isPending;

  return (
    <TooltipProvider delayDuration={300}>
      <section className="p-6">
        {loadError && (
          <LoadErrorState
            title="Couldn't load your automations"
            message={loadError}
            onRetry={() => workflowsQuery.refetch()}
            isRetrying={workflowsQuery.isFetching}
          />
        )}

        {showEmptyState && (
          <EmptyState
            icon={IconRobot}
            title="No automations yet"
            // Three concrete things this business could switch on today, not an
            // abstract description of what automation is. The blank-canvas
            // problem is the biggest adoption risk in the feature.
            description="Follow up after a completed job. Chase an overdue invoice. Remind a customer their service agreement is expiring."
            subtitle="An automation runs on its own when something happens in your business."
            actionLabel="Browse templates"
            onAction={handleCreate}
          />
        )}

        {!loadError && !showEmptyState && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <StatusFilterTabs
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              />
              <div className="ml-auto flex items-center gap-2">
                <SearchInput
                  value={search}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder="Search automations..."
                />
                {/* The count, matching the other list pages. Reads the server's
                    total rather than the rows on screen, so it does not say "3"
                    on page two of forty. */}
                {!loading && (
                  <span className="hidden shrink-0 items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground font-body sm:inline-flex">
                    {pagination?.total ?? visible.length}{" "}
                    {(pagination?.total ?? visible.length) === 1
                      ? "automation"
                      : "automations"}
                  </span>
                )}
                {/* Opens the gallery, which is instant — so no pending state
                    here any more. The wait moved to the gallery's own buttons,
                    which are the things that now create a record. */}
                <Button
                  onClick={handleCreate}
                  size="sm"
                  className="bg-brand text-brand-foreground hover:bg-brand/90 font-body shrink-0"
                >
                  <IconPlus className="mr-1.5 h-3.5 w-3.5" />
                  New automation
                </Button>
              </div>
            </div>

            {loading && <TableSkeleton columns={6} />}

            {!loading && visible.length > 0 && (
              <AutomationsTable
                workflows={visible}
                archived={statusFilter === "archived"}
                pendingIds={pendingIds}
                onToggleActive={(workflow, next) =>
                  activeMutation.mutate({ id: workflow.id, isActive: next })
                }
                onRename={(workflow) => {
                  setRenaming(workflow);
                  setNameDialogOpen(true);
                }}
                onArchive={setArchiving}
              />
            )}

            {showNoResults && (
              <p className="py-12 text-center text-sm text-muted-foreground font-body">
                No automations found
                {search ? <> matching &ldquo;{search}&rdquo;</> : " for this filter"}.
              </p>
            )}

            {/* Hidden for `draft`, whose filtering happens client-side and whose
                total would therefore contradict the rows above it. */}
            {!loading &&
              statusFilter !== "draft" &&
              pagination &&
              pagination.totalPages > 1 && (
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  onPageChange={setPage}
                  entityName="automation"
                />
              )}
          </div>
        )}

        <TemplateGallery
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          // Read off what the tenant already has, so a card can say "already
          // added" rather than letting somebody install the same chase sequence
          // three times without noticing.
          installedTemplateKeys={workflows
            .map((w) => w.templateKey)
            .filter((key): key is string => Boolean(key))}
          onUse={handleUseTemplate}
          onStartBlank={handleStartBlank}
          pending={templateMutation.isPending || createMutation.isPending}
        />

        <AutomationNameDialog
          open={nameDialogOpen}
          onOpenChange={(open) => {
            setNameDialogOpen(open);
            if (!open) setRenaming(null);
          }}
          onSubmit={handleRename}
          loading={savingName}
          initial={
            renaming
              ? { name: renaming.name, description: renaming.description ?? "" }
              : null
          }
        />

        <DeleteConfirmDialog
          entityName="Automation"
          itemLabel={archiving?.name ?? ""}
          description="This automation will be switched off and moved to Archived. Its run history is kept."
          open={archiving !== null}
          onOpenChange={(open) => {
            if (!open) setArchiving(null);
          }}
          onConfirm={handleArchive}
          loading={archiveMutation.isPending}
        />
      </section>
    </TooltipProvider>
  );
}
