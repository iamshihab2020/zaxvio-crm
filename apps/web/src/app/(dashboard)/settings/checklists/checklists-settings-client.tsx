"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { IconPlus, IconChecklist } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  ChecklistTemplateList,
  type ChecklistTemplate,
} from "@/components/dashboard/checklists/checklist-template-list";
import {
  ChecklistTemplateDialog,
  type TemplateFormData,
} from "@/components/dashboard/checklists/checklist-template-dialog";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { EmptyState } from "@/components/reusable/empty-state";
import {
  getChecklistTemplates,
  getChecklistTemplate,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
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
import { IconSelector, IconCheck, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

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

export function ChecklistsSettingsClient() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterServiceType, setFilterServiceType] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithItems | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<ChecklistTemplate | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const result = await getChecklistTemplates({
      serviceType: filterServiceType || undefined,
      showInactive,
    });
    if (result.data) {
      setTemplates(result.data);
    }
    setLoading(false);
  }, [filterServiceType, showInactive]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  function openCreateDialog() {
    setEditingTemplate(null);
    setDialogOpen(true);
  }

  async function openEditDialog(template: ChecklistTemplate) {
    // Fetch full template with items
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
    setSaving(true);

    if (editingTemplate) {
      // Update template metadata
      const metaResult = await updateChecklistTemplate(editingTemplate.id, {
        name: data.name,
        serviceType: data.serviceType,
        isActive: data.isActive,
      });

      if (metaResult.error) {
        toast.error(metaResult.error);
        setSaving(false);
        return;
      }

      // Sync items: delete removed, update existing, add new
      const existingItems = editingTemplate.items ?? [];
      const newItems = data.items;

      // Find items to delete (in existing but not in new)
      const newItemIds = new Set(newItems.filter((i) => i.id).map((i) => i.id));
      for (const existing of existingItems) {
        if (!newItemIds.has(existing.id)) {
          await deleteChecklistItem(editingTemplate.id, existing.id);
        }
      }

      // Update/add items
      for (const item of newItems) {
        if (item.id) {
          await updateChecklistItem(editingTemplate.id, item.id, {
            label: item.label,
            isRequired: item.isRequired,
            catalogItemId: item.catalogItemId,
            sortOrder: item.sortOrder,
          });
        } else {
          await addChecklistItem(editingTemplate.id, {
            label: item.label,
            isRequired: item.isRequired,
            catalogItemId: item.catalogItemId,
            sortOrder: item.sortOrder,
          });
        }
      }

      toast.success("Checklist template updated");
    } else {
      // Create new template with items
      const result = await createChecklistTemplate({
        name: data.name,
        serviceType: data.serviceType,
        isActive: data.isActive,
        items: data.items.map((item) => ({
          label: item.label,
          isRequired: item.isRequired,
          catalogItemId: item.catalogItemId,
          sortOrder: item.sortOrder,
        })),
      });

      if (result.error) {
        toast.error(result.error);
        setSaving(false);
        return;
      }

      toast.success("Checklist template created");
    }

    setDialogOpen(false);
    setSaving(false);
    fetchTemplates();
  }

  async function handleToggleActive(template: ChecklistTemplate) {
    const result = await updateChecklistTemplate(template.id, {
      isActive: !template.isActive,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        template.isActive ? "Template deactivated" : "Template activated",
      );
      fetchTemplates();
    }
  }

  async function handleDelete() {
    if (!deletingTemplate) return;
    setSaving(true);
    const result = await deleteChecklistTemplate(deletingTemplate.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Checklist template deleted");
      setDeleteDialogOpen(false);
      setDeletingTemplate(null);
      fetchTemplates();
    }
    setSaving(false);
  }

  const hasTemplates = templates.length > 0;
  const showEmptyState = !loading && !hasTemplates && !filterServiceType;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-body">
          Define checklists that auto-attach to new jobs by service type.
        </p>
        <Button
          onClick={openCreateDialog}
          className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
        >
          <IconPlus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Filters */}
      {!showEmptyState && (
        <div className="flex items-center gap-3 mb-4">
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-body cursor-pointer"
              >
                {filterServiceType
                  ? SERVICE_TYPE_LABELS[filterServiceType as ServiceType]
                  : "All Service Types"}
                <IconSelector className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-1" align="start">
              <button
                type="button"
                onClick={() => {
                  setFilterServiceType("");
                  setFilterOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer font-body"
              >
                {!filterServiceType && (
                  <IconCheck className="h-4 w-4 text-brand shrink-0" />
                )}
                <span className={cn(!filterServiceType ? "" : "pl-6")}>
                  All Types
                </span>
              </button>
              {SERVICE_TYPES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setFilterServiceType(st);
                    setFilterOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer font-body"
                >
                  {filterServiceType === st && (
                    <IconCheck className="h-4 w-4 text-brand shrink-0" />
                  )}
                  <span className={cn(filterServiceType !== st && "pl-6")}>
                    {SERVICE_TYPE_LABELS[st]}
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <label className="flex items-center gap-2 text-sm text-muted-foreground font-body cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-brand cursor-pointer"
            />
            Show inactive
          </label>
        </div>
      )}

      {showEmptyState && (
        <EmptyState
          icon={IconChecklist}
          title="No checklist templates yet"
          description="Create a template to auto-attach checklists when new jobs are created."
          actionLabel="New Template"
          onAction={openCreateDialog}
        />
      )}

      {!loading && hasTemplates && !showEmptyState && (
        <ChecklistTemplateList
          templates={templates}
          loading={loading}
          onEdit={openEditDialog}
          onDelete={openDeleteDialog}
          onToggleActive={handleToggleActive}
        />
      )}

      {!loading && !hasTemplates && filterServiceType && (
        <p className="py-12 text-center text-sm text-muted-foreground font-body">
          No checklist templates found for this service type.
        </p>
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
    </div>
  );
}
