"use client";

import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconPlus,
  IconListDetails,
  IconTool,
  IconSettings,
  IconPackage,
  IconBolt,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { StatsCards } from "@/components/dashboard/reusable/stats-cards";
import { SearchInput } from "@/components/reusable/search-input";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { EmptyState } from "@/components/reusable/empty-state";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { CatalogTable } from "@/components/dashboard/catalog/catalog-table";
import { CatalogItemDialog, type CatalogItemFormData } from "@/components/dashboard/catalog/catalog-item-dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { seeded } from "@/hooks/queries/seed";
import {
  useCatalogItems,
  useCatalogCategories,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
  prefetchCatalogItems,
} from "@/hooks/queries";
import type { CatalogItem } from "@hvac-saas/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { IconCheck, IconChevronDown, IconArchive } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CATALOG_CATEGORIES } from "@/lib/constants/catalog-options";

const TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "labor", label: "Labor" },
  { value: "part", label: "Part" },
  { value: "material", label: "Material" },
  { value: "service_call", label: "Service Call" },
  { value: "other", label: "Other" },
];

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DEFAULT_PAGINATION: PaginationData = { page: 1, limit: 15, total: 0, totalPages: 0 };

interface CatalogPageClientProps {
  initialItems?: CatalogItem[];
  initialPagination?: PaginationData;
  initialCategories?: string[];
}

export function CatalogPageClient({
  initialItems = [],
  initialPagination,
  initialCategories = [],
}: CatalogPageClientProps) {
  // UI state
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(initialPagination?.page ?? 1);
  const [filterItemType, setFilterItemType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);

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
  // ARC-06
  const itemsQuery = useCatalogItems(listParams, {
    seed: seeded(
      page === 1 && !debouncedSearch && !filterItemType && !showArchived,
      { data: initialItems, pagination: initialPagination, error: null },
    ),
  });
  const categoriesQuery = useCatalogCategories(
    seeded(initialCategories.length > 0, {
      data: initialCategories,
      error: null,
    }),
  );

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

  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  // ── Derived ────────────────────────────────────────────────
  const stats = useMemo(() => {
    let labor = 0, part = 0, material = 0, service = 0;
    for (const item of items) {
      if (item.itemType === "labor") labor++;
      else if (item.itemType === "part") part++;
      else if (item.itemType === "material") material++;
      else if (item.itemType === "service_call") service++;
    }
    return { labor, part, material, service };
  }, [items]);

  const mergedCategories = useMemo(() => {
    const set = new Set<string>([...CATALOG_CATEGORIES, ...categories]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const selectedCategoryLabel = filterCategory || "All Categories";

  // ── Handlers ───────────────────────────────────────────────
  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function openCreateDialog() {
    setEditingItem(null);
    setError(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: CatalogItem) {
    setEditingItem(item);
    setError(null);
    setDialogOpen(true);
  }

  function openDeleteDialog(item: CatalogItem) {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  }

  function handleSave(data: CatalogItemFormData) {
    setError(null);
    const payload = {
      name: data.name,
      itemType: data.itemType,
      unitPrice: data.unitPrice,
      unit: data.unit,
      category: data.category || undefined,
      description: data.description || undefined,
    };
    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, data: payload },
        {
          onSuccess: (res) => {
            if (res.error) { setError(res.error); return; }
            setDialogOpen(false);
          },
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (res) => {
          if (res.error) { setError(res.error); return; }
          setDialogOpen(false);
          setPage(1);
        },
      });
    }
  }

  function handleArchiveToggle(item: CatalogItem) {
    setError(null);
    updateMutation.mutate(
      { id: item.id, data: { isActive: !item.isActive } },
      {
        onSuccess: (res) => {
          if (res.error) setError(res.error);
        },
      },
    );
  }

  function handleDelete() {
    if (!deletingItem) return;
    setError(null);
    deleteMutation.mutate(deletingItem.id, {
      onSuccess: (res) => {
        if (res.error) { setError(res.error); return; }
        setDeleteDialogOpen(false);
        setDeletingItem(null);
      },
    });
  }

  const hasItems = items.length > 0;
  const showEmptyState = !loading && !hasItems && !search && !filterItemType;
  const showNoResults = !loading && !hasItems && (!!search || !!filterItemType);

  return (
    <section className="p-6">
      {/* Stats Cards */}
      {!showEmptyState && (
        <StatsCards
          stats={[
            { label: "Labor", count: stats.labor, icon: IconTool, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
            { label: "Part", count: stats.part, icon: IconSettings, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
            { label: "Material", count: stats.material, icon: IconPackage, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
            { label: "Service Call", count: stats.service, icon: IconBolt, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40", filterValue: "service_call" },
          ]}
          activeFilter={filterItemType}
          onFilterChange={setFilterItemType}
          className="mb-4"
        />
      )}

      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive font-body">
          {error}
        </div>
      )}

      {/* Empty state */}
      {showEmptyState && (
        <EmptyState
          icon={IconListDetails}
          title="No catalog items yet"
          description="Add your first service, part, or material to build your catalog."
          actionLabel="Add Item"
          onAction={openCreateDialog}
        />
      )}

      {/* Card wrapper */}
      {!showEmptyState && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <StatusFilterTabs
              options={TYPE_OPTIONS}
              value={filterItemType}
              onChange={setFilterItemType}
            />
            <div className="ml-auto flex items-center gap-2">
              <SearchInput
                value={search}
                onChange={handleSearchChange}
                placeholder="Search catalog..."
              />

              {/* Category Filter */}
              <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0" role="combobox" aria-expanded={categoryOpen}>
                    {selectedCategoryLabel}
                    <IconChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Search categories..." />
                    <CommandList>
                      <CommandEmpty>No category found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all-categories"
                          onSelect={() => {
                            setFilterCategory("");
                            setCategoryOpen(false);
                          }}
                        >
                          <IconCheck
                            className={cn(
                              "mr-2 h-3.5 w-3.5",
                              !filterCategory ? "opacity-100" : "opacity-0",
                            )}
                          />
                          All Categories
                        </CommandItem>
                        {mergedCategories.map((cat) => (
                          <CommandItem
                            key={cat}
                            value={cat}
                            onSelect={(val) => {
                              setFilterCategory(val);
                              setCategoryOpen(false);
                            }}
                          >
                            <IconCheck
                              className={cn(
                                "mr-2 h-3.5 w-3.5",
                                filterCategory === cat ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {cat}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Archived Toggle */}
              <Button
                variant={showArchived ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className="gap-1.5 shrink-0"
              >
                <IconArchive className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {showArchived ? "Showing archived" : "Show archived"}
                </span>
              </Button>

              <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground font-body shrink-0">
                {pagination.total} {pagination.total === 1 ? "Item" : "Items"}
              </span>
              <Button onClick={openCreateDialog} size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90 font-body">
                <IconPlus className="mr-1.5 h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="p-4">
              <TableSkeleton columns={6} rows={5} />
            </div>
          )}

          {/* No results */}
          {showNoResults && (
            <p className="py-12 text-center text-sm text-muted-foreground font-body">
              No catalog items found matching your filters.
            </p>
          )}

          {/* Table */}
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

      {/* Pagination */}
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
