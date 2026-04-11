"use client";

import { useState, useEffect, useCallback } from "react";
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
  getCatalogItems,
  getCatalogCategories,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  bulkDeleteCatalogItems,
  bulkToggleCatalogActive,
} from "@/actions/catalog";
import { useRowSelection } from "@/hooks/use-row-selection";
import { toast } from "sonner";
import type { CatalogItem } from "@hvac-saas/types";

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function CatalogSettingsPageClient() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [filterItemType, setFilterItemType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkToggleOpen, setBulkToggleOpen] = useState(false);
  const [bulkToggleValue, setBulkToggleValue] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(
    async (page: number, searchTerm: string, itemType: string, archived: boolean) => {
      setLoading(true);
      const result = await getCatalogItems({
        search: searchTerm,
        page,
        limit: 15,
        itemType: itemType || undefined,
        showArchived: archived,
      });
      if (result.data) {
        setItems(result.data);
        setPagination(
          result.pagination ?? { page, limit: 15, total: 0, totalPages: 0 },
        );
      }
      setLoading(false);
    },
    [],
  );

  const fetchCategories = useCallback(async () => {
    const result = await getCatalogCategories();
    if (result.data) {
      setCategories(result.data);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchItems(1, "", "", false);
    fetchCategories();
  }, [fetchItems, fetchCategories]);

  // Debounced search/filter, clear selection
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems(1, search, filterItemType, showArchived);
      clearSelection();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterItemType, showArchived, fetchItems]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePageChange(newPage: number) {
    fetchItems(newPage, search, filterItemType, showArchived);
  }

  async function handleBulkDelete() {
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const result = await bulkDeleteCatalogItems(ids);
    setBulkLoading(false);
    setBulkDeleteOpen(false);
    if (result.error && result.succeeded === 0) {
      toast.error(result.error);
    } else {
      toast.success(`Deleted ${result.succeeded} item${result.succeeded !== 1 ? "s" : ""}${result.failed > 0 ? ` (${result.failed} failed)` : ""}`);
      clearSelection();
      fetchItems(pagination.page, search, filterItemType, showArchived);
    }
  }

  async function handleBulkToggleActive() {
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const result = await bulkToggleCatalogActive(ids, bulkToggleValue);
    setBulkLoading(false);
    setBulkToggleOpen(false);
    if (result.error && result.succeeded === 0) {
      toast.error(result.error);
    } else {
      const label = bulkToggleValue ? "activated" : "archived";
      toast.success(`${result.succeeded} item${result.succeeded !== 1 ? "s" : ""} ${label}${result.failed > 0 ? ` (${result.failed} failed)` : ""}`);
      clearSelection();
      fetchItems(pagination.page, search, filterItemType, showArchived);
    }
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

  async function handleSave(data: CatalogItemFormData) {
    setSaving(true);
    setError(null);
    if (editingItem) {
      const result = await updateCatalogItem(editingItem.id, {
        name: data.name,
        itemType: data.itemType,
        unitPrice: data.unitPrice,
        unit: data.unit,
        category: data.category || undefined,
        description: data.description || undefined,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setDialogOpen(false);
        fetchItems(pagination.page, search, filterItemType, showArchived);
        fetchCategories();
      }
    } else {
      const result = await createCatalogItem({
        name: data.name,
        itemType: data.itemType,
        unitPrice: data.unitPrice,
        unit: data.unit,
        category: data.category || undefined,
        description: data.description || undefined,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setDialogOpen(false);
        fetchItems(1, search, filterItemType, showArchived);
        fetchCategories();
      }
    }
    setSaving(false);
  }

  async function handleArchiveToggle(item: CatalogItem) {
    setSaving(true);
    setError(null);
    const result = await updateCatalogItem(item.id, {
      isActive: !item.isActive,
    });
    if (result.error) {
      setError(result.error);
    } else {
      fetchItems(pagination.page, search, filterItemType, showArchived);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deletingItem) return;
    setSaving(true);
    setError(null);
    const result = await deleteCatalogItem(deletingItem.id);
    if (result.error) {
      setError(result.error);
    } else {
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      fetchItems(pagination.page, search, filterItemType, showArchived);
    }
    setSaving(false);
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
