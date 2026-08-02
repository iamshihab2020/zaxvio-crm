"use client";

import { useState, useMemo } from "react";
import { seeded } from "@/hooks/queries/seed";
import { toast } from "sonner";
import {
  IconPlus,
  IconChecklist,
  IconCircleCheck,
  IconCircleOff,
  IconStack2,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { StatsCards } from "@/components/dashboard/reusable/stats-cards";
import { SearchInput } from "@/components/reusable/search-input";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { EmptyState } from "@/components/reusable/empty-state";
import {
  ChecklistTemplateList,
  type ChecklistTemplate,
} from "@/components/dashboard/checklists/checklist-template-list";
import {
  ChecklistTemplateDialog,
  type TemplateFormData,
} from "@/components/dashboard/checklists/checklist-template-dialog";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import {
  useChecklistTemplates,
  useCreateChecklistTemplate,
  useUpdateChecklistTemplate,
  useDeleteChecklistTemplate,
} from "@/hooks/queries";
import {
  getChecklistTemplate,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from "@/actions/checklists";
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/lib/constants/job-options";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { IconSelector, IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

interface TemplateWithItems extends ChecklistTemplate {
  items?: Array<{
    id: string;
    label: string;
    isRequired: boolean;
    catalogItemId: string | null;
    catalogItemName?: string | null;
    catalogItemPrice?: string | null;
    sortOrder: number;
  }>;
}

interface ChecklistsPageClientProps {
  initialTemplates?: ChecklistTemplate[];
}

export function ChecklistsPageClient({
  initialTemplates = [],
}: ChecklistsPageClientProps) {
  // UI state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filterServiceType, setFilterServiceType] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithItems | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<ChecklistTemplate | null>(null);
  const [savingItems, setSavingItems] = useState(false);

  // ── Queries ────────────────────────────────────────────────
  const listParams = {
    serviceType: filterServiceType || undefined,
    showInactive: statusFilter === "inactive" || statusFilter === "",
  };
  // ARC-06
  const templatesQuery = useChecklistTemplates(
    listParams,
    seeded(!filterServiceType && initialTemplates.length > 0, {
      data: initialTemplates,
      error: null,
    }),
  );

  const templates = (templatesQuery.data?.data ?? []) as ChecklistTemplate[];
  const loading = templatesQuery.isLoading;

  // ── Mutations ──────────────────────────────────────────────
  const createMutation = useCreateChecklistTemplate();
  const updateMutation = useUpdateChecklistTemplate();
  const deleteMutation = useDeleteChecklistTemplate();

  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || savingItems;

  // ── Derived ────────────────────────────────────────────────
  const stats = useMemo(() => {
    let active = 0, inactive = 0;
    for (const t of templates) {
      if (t.isActive) active++;
      else inactive++;
    }
    return { total: templates.length, active, inactive };
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (statusFilter === "active") result = result.filter((t) => t.isActive);
    else if (statusFilter === "inactive") result = result.filter((t) => !t.isActive);
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(lowerSearch));
    }
    return result;
  }, [templates, statusFilter, search]);

  // ── Handlers ───────────────────────────────────────────────
  function openCreateDialog() {
    setEditingTemplate(null);
    setDialogOpen(true);
  }

  async function openEditDialog(template: ChecklistTemplate) {
    const result = await getChecklistTemplate(template.id);
    if (result.data) {
      setEditingTemplate(result.data);
    } else {
      setEditingTemplate(template as TemplateWithItems);
    }
    setDialogOpen(true);
  }

  function openDeleteDialog(template: ChecklistTemplate) {
    setDeletingTemplate(template);
    setDeleteDialogOpen(true);
  }

  async function handleSave(data: TemplateFormData) {
    if (editingTemplate) {
      // Update template meta, then sync items
      setSavingItems(true);
      try {
        const metaResult = await updateMutation.mutateAsync({
          id: editingTemplate.id,
          data: { name: data.name, serviceType: data.serviceType, isActive: data.isActive },
        });
        if (metaResult.error) { setSavingItems(false); return; }

        const existingItems = editingTemplate.items ?? [];
        const newItems = data.items;
        const newItemIds = new Set(newItems.filter((i) => i.id).map((i) => i.id));
        const toDelete = existingItems.filter((e) => !newItemIds.has(e.id));
        const toUpdate = newItems.filter((i) => i.id);
        const toCreate = newItems.filter((i) => !i.id);

        await Promise.all([
          ...toDelete.map((item) => deleteChecklistItem(editingTemplate.id, item.id)),
          ...toUpdate.map((item) =>
            updateChecklistItem(editingTemplate.id, item.id!, {
              label: item.label,
              isRequired: item.isRequired,
              catalogItemId: item.catalogItemId,
              sortOrder: item.sortOrder,
            }),
          ),
          ...toCreate.map((item) =>
            addChecklistItem(editingTemplate.id, {
              label: item.label,
              isRequired: item.isRequired,
              catalogItemId: item.catalogItemId,
              sortOrder: item.sortOrder,
            }),
          ),
        ]);

        setDialogOpen(false);
      } catch {
        toast.error("Failed to save checklist items");
      } finally {
        setSavingItems(false);
      }
    } else {
      createMutation.mutate(
        {
          name: data.name,
          serviceType: data.serviceType,
          isActive: data.isActive,
          items: data.items.map((item) => ({
            label: item.label,
            isRequired: item.isRequired,
            catalogItemId: item.catalogItemId,
            sortOrder: item.sortOrder,
          })),
        },
        { onSuccess: (res) => { if (!res.error) setDialogOpen(false); } },
      );
    }
  }

  function handleToggleActive(template: ChecklistTemplate) {
    updateMutation.mutate({ id: template.id, data: { isActive: !template.isActive } });
  }

  function handleDelete() {
    if (!deletingTemplate) return;
    deleteMutation.mutate(deletingTemplate.id, {
      onSuccess: (res) => {
        if (!res.error) {
          setDeleteDialogOpen(false);
          setDeletingTemplate(null);
        }
      },
    });
  }

  const hasTemplates = filteredTemplates.length > 0;
  const showEmptyState = !loading && templates.length === 0 && !filterServiceType && !search && !statusFilter;
  const showNoResults = !loading && !hasTemplates && (!!search || !!statusFilter || !!filterServiceType);

  return (
    <section className="p-6">
      {/* Stats Cards */}
      {!showEmptyState && (
        <StatsCards
          stats={[
            { label: "Total", count: stats.total, icon: IconStack2, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
            { label: "Active", count: stats.active, icon: IconCircleCheck, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
            { label: "Inactive", count: stats.inactive, icon: IconCircleOff, color: "text-muted-foreground", bg: "bg-muted/50" },
          ]}
          className="mb-4"
        />
      )}

      {/* Empty state */}
      {showEmptyState && (
        <EmptyState
          icon={IconChecklist}
          title="No checklist templates yet"
          description="Create a template to auto-attach checklists when new jobs are created."
          actionLabel="New Template"
          onAction={openCreateDialog}
        />
      )}

      {/* Card wrapper */}
      {!showEmptyState && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <StatusFilterTabs
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <div className="ml-auto flex items-center gap-2">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search templates..."
              />

              {/* Service Type Filter */}
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                    {filterServiceType
                      ? SERVICE_TYPE_LABELS[filterServiceType as ServiceType]
                      : "All Service Types"}
                    <IconSelector className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-1" align="end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterServiceType("");
                      setFilterOpen(false);
                    }}
                    className="w-full justify-start gap-2 font-body"
                  >
                    {!filterServiceType && (
                      <IconCheck className="h-4 w-4 text-brand shrink-0" />
                    )}
                    <span className={cn(!filterServiceType ? "" : "pl-6")}>
                      All Types
                    </span>
                  </Button>
                  {SERVICE_TYPES.map((st) => (
                    <Button
                      key={st}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilterServiceType(st);
                        setFilterOpen(false);
                      }}
                      className="w-full justify-start gap-2 font-body"
                    >
                      {filterServiceType === st && (
                        <IconCheck className="h-4 w-4 text-brand shrink-0" />
                      )}
                      <span className={cn(filterServiceType !== st && "pl-6")}>
                        {SERVICE_TYPE_LABELS[st]}
                      </span>
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>

              <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground font-body shrink-0">
                {filteredTemplates.length} {filteredTemplates.length === 1 ? "Template" : "Templates"}
              </span>
              <Button onClick={openCreateDialog} size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90 font-body">
                <IconPlus className="mr-1.5 h-3.5 w-3.5" />
                New Template
              </Button>
            </div>
          </div>

          {/* List */}
          {!loading && hasTemplates && (
            <ChecklistTemplateList
              templates={filteredTemplates}
              loading={loading}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
              onToggleActive={handleToggleActive}
            />
          )}

          {/* No results */}
          {showNoResults && (
            <p className="py-12 text-center text-sm text-muted-foreground font-body">
              No checklist templates found{search ? <> matching &ldquo;{search}&rdquo;</> : " for this filter"}.
            </p>
          )}
        </div>
      )}

      <ChecklistTemplateDialog
        template={editingTemplate}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        loading={saving}
      />

      <DeleteConfirmDialog
        entityName="Checklist Template"
        itemLabel={deletingTemplate?.name ?? ""}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
      />
    </section>
  );
}
