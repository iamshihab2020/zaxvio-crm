"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { IconPlus, IconListDetails, IconTrash, IconArchive, IconArchiveOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { CatalogTable } from "@/components/dashboard/catalog/catalog-table";
import { CatalogItemDialog, type CatalogItemFormData } from "@/components/dashboard/catalog/catalog-item-dialog";
import { CatalogFilters } from "@/components/dashboard/catalog/catalog-filters";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { BulkActionBar } from "@/components/reusable/bulk-action-bar";
import { BulkConfirmDialog } from "@/components/reusable/bulk-confirm-dialog";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { EmptyState } from "@/components/reusable/empty-state";
import {
  useCatalogItems,
  useCatalogCategories,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
  useBulkDeleteCatalogItems,
  useBulkToggleCatalogActive,
  prefetchCatalogItems,
} from "@/hooks/queries";
import { useRowSelection } from "@/hooks/use-row-selection";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { CatalogItem } from "@hvac-saas/types";

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DEFAULT_PAGINATION: PaginationData = { page: 1, limit: 15, total: 0, totalPages: 0 };

export function CatalogSettingsPageClient() {
  // UI filter state
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterItemType, setFilterItemType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);

  // Row selection
  const {
    selectedIds,
    toggle,
    toggleAll,
    clearSelection,
    isAllSelected,
    isIndeterminate,
    selectedCount,
  } = useRowSelection();

  // Bulk action state
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkToggleOpen, setBulkToggleOpen] = useState(false);
  const [bulkToggleValue, setBulkToggleValue] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────
  const listParams = {
    search: debouncedSearch,
    page,
    limit: 15,
    itemType: filterItemType || undefined,
    showArchived,
  };
  const itemsQuery = useCatalogItems(listParams);

  const categoriesQuery = useCatalogCategories();

  const items = itemsQuery.data?.data ?? [];
  const pagination = itemsQuery.data?.pagination ?? DEFAULT_PAGINATION;
  const loading = itemsQuery.isLoading;
  const categories = categoriesQuery.data?.data ?? [];

  // Prefetch next page
  const queryClient = useQueryClient();
  useEffect(() => {
    if (pagination && page < pagination.totalPages) {
      prefetchCatalogItems(queryClient, { ...listParams, page: page + 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pagination?.totalPages]);

  // ── Mutations ──────────────────────────────────────────────
  const createMutation = useCreateCatalogItem();
  const updateMutation = useUpdateCatalogItem();
  const deleteMutation = useDeleteCatalogItem();
  const bulkDeleteMutation = useBulkDeleteCatalogItems();
  const bulkToggleActiveMutation = useBulkToggleCatalogActive();

  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const bulkLoading = bulkDeleteMutation.isPending || bulkToggleActiveMutation.isPending;

  // ── Handlers ───────────────────────────────────────────────
  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handleBulkDelete() {
    bulkDeleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: (res) => {
        if (!res.error) { setBulkDeleteOpen(false); clearSelection(); }
      },
    });
  }

  function handleBulkToggleActive() {
    bulkToggleActiveMutation.mutate({ ids: Array.from(selectedIds), isActive: bulkToggleValue }, {
      onSuccess: (res) => {
        if (!res.error) { setBulkToggleOpen(false); clearSelection(); }
      },
    });
  }

  function openCreateDialog() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: CatalogItem) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  function openDeleteDialog(item: CatalogItem) {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  }

  function handleSave(data: CatalogItemFormData) {
    setError(null);
    const formData = {
      name: data.name,
      itemType: data.itemType,
      unitPrice: data.unitPrice,
      // Sent even when null: clearing a cost has to reach the API, or an item
      // can be costed once and never un-costed.
      unitCost: data.unitCost,
      unit: data.unit,
      category: data.category || undefined,
      description: data.description || undefined,
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData }, {
        onSuccess: (res) => {
          if (!res.error) setDialogOpen(false);
        },
      });
    } else {
      createMutation.mutate(formData, {
        onSuccess: (res) => {
          if (!res.error) {
            setDialogOpen(false);
            setPage(1);
          }
        },
      });
    }
  }

  function handleArchiveToggle(item: CatalogItem) {
    setError(null);
    updateMutation.mutate({ id: item.id, data: { isActive: !item.isActive } });
  }

  function handleDelete() {
    if (!deletingItem) return;
    setError(null);
    deleteMutation.mutate(deletingItem.id, {
      onSuccess: (res) => {
        if (!res.error) {
          setDeleteDialogOpen(false);
          setDeletingItem(null);
        }
      },
    });
  }

  const hasItems = items.length > 0;
  const showEmptyState = !loading && !hasItems && !search && !filterItemType;
  const showNoResults = !loading && !hasItems && (!!search || !!filterItemType);

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive font-body">
          {error}
        </div>
      )}

      {showEmptyState && (
        <EmptyState
          icon={IconListDetails}
          title="No catalog items yet"
          description="Add your first service, part, or material to build your catalog."
          actionLabel="Add Item"
          onAction={openCreateDialog}
        />
      )}

      {!showEmptyState && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <CatalogFilters
            search={search}
            onSearchChange={setSearch}
            filterItemType={filterItemType}
            onFilterItemTypeChange={setFilterItemType}
            filterCategory={filterCategory}
            onFilterCategoryChange={setFilterCategory}
            showArchived={showArchived}
            onShowArchivedChange={setShowArchived}
            categories={categories}
            totalItems={pagination.total}
            action={
              <Button
                onClick={openCreateDialog}
                size="sm"
                className="bg-brand text-brand-foreground hover:bg-brand/90 shrink-0"
              >
                <IconPlus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            }
          />

          {loading && <TableSkeleton columns={6} rows={5} />}

          {showNoResults && (
            <p className="py-12 text-center text-sm text-muted-foreground font-body">
              No catalog items found matching your filters.
            </p>
          )}

          {!loading && hasItems && (
            <CatalogTable
              items={items}
              showArchived={showArchived}
              onEdit={openEditDialog}
              onArchiveToggle={handleArchiveToggle}
              onDelete={openDeleteDialog}
              selectedIds={selectedIds}
              onToggle={toggle}
              onToggleAll={toggleAll}
              isAllSelected={isAllSelected(items)}
              isIndeterminate={isIndeterminate(items)}
            />
          )}
        </div>
      )}

      {!loading && hasItems && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={handlePageChange}
          entityName="item"
        />
      )}

      <CatalogItemDialog
        item={editingItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        loading={saving}
        categories={categories}
      />

      <DeleteConfirmDialog
        entityName="Catalog Item"
        itemLabel={deletingItem?.name ?? ""}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
      />

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        loading={bulkLoading}
        actions={[
          {
            label: "Set Active",
            icon: IconArchiveOff,
            onClick: () => { setBulkToggleValue(true); setBulkToggleOpen(true); },
            variant: "default",
          },
          {
            label: "Archive",
            icon: IconArchive,
            onClick: () => { setBulkToggleValue(false); setBulkToggleOpen(true); },
            variant: "default",
          },
          {
            label: "Delete",
            icon: IconTrash,
            onClick: () => setBulkDeleteOpen(true),
            variant: "destructive",
          },
        ]}
      />

      {/* Bulk delete confirmation */}
      <BulkConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        loading={bulkLoading}
        title={`Delete ${selectedCount} Item${selectedCount !== 1 ? "s" : ""}`}
        description={`This will permanently delete ${selectedCount} catalog item${selectedCount !== 1 ? "s" : ""}. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
      />

      {/* Bulk toggle active/archive confirmation */}
      <BulkConfirmDialog
        open={bulkToggleOpen}
        onOpenChange={setBulkToggleOpen}
        onConfirm={handleBulkToggleActive}
        loading={bulkLoading}
        title={`${bulkToggleValue ? "Activate" : "Archive"} ${selectedCount} Item${selectedCount !== 1 ? "s" : ""}`}
        description={`This will ${bulkToggleValue ? "restore and activate" : "archive"} ${selectedCount} catalog item${selectedCount !== 1 ? "s" : ""}.`}
        confirmLabel={bulkToggleValue ? "Activate" : "Archive"}
        variant="default"
      />
    </div>
  );
}
