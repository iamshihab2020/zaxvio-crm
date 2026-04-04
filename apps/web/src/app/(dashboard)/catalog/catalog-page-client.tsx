"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconListDetails } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { CatalogTable } from "@/components/dashboard/catalog/catalog-table";
import { CatalogItemDialog, type CatalogItemFormData } from "@/components/dashboard/catalog/catalog-item-dialog";
import { CatalogFilters } from "@/components/dashboard/catalog/catalog-filters";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { PageHeader } from "@/components/reusable/page-header";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { EmptyState } from "@/components/reusable/empty-state";
import {
  getCatalogItems,
  getCatalogCategories,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
} from "@/actions/catalog";
import type { CatalogItem } from "@hvac-saas/types";

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function CatalogPageClient() {
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

  useEffect(() => {
    fetchItems(1, "", "", false);
    fetchCategories();
  }, [fetchItems, fetchCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems(1, search, filterItemType, showArchived);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterItemType, showArchived, fetchItems]);

  function handlePageChange(newPage: number) {
    fetchItems(newPage, search, filterItemType, showArchived);
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
    const result = await updateCatalogItem(item.id, { isActive: !item.isActive });
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
    <section className="p-6">
      <PageHeader
        title="Catalog"
        subtitle="Manage your parts, labor rates, and service items."
        action={
          <Button onClick={openCreateDialog} size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90 font-body">
            <IconPlus className="mr-1.5 h-3.5 w-3.5" />
            Add Item
          </Button>
        }
        className="mb-4"
      />

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
    </section>
  );
}
