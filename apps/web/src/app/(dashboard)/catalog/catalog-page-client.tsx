"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  IconPlus,
  IconListDetails,
  IconTool,
  IconSettings,
  IconPackage,
  IconBolt,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/reusable/page-header";
import { StatsCards } from "@/components/dashboard/reusable/stats-cards";
import { SearchInput } from "@/components/reusable/search-input";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { EmptyState } from "@/components/reusable/empty-state";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { CatalogTable } from "@/components/dashboard/catalog/catalog-table";
import { CatalogItemDialog, type CatalogItemFormData } from "@/components/dashboard/catalog/catalog-item-dialog";
import {
  getCatalogItems,
  getCatalogCategories,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
} from "@/actions/catalog";
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
  const [items, setItems] = useState<CatalogItem[]>(initialItems);
  const [pagination, setPagination] = useState<PaginationData>(
    initialPagination ?? { page: 1, limit: 15, total: 0, totalPages: 0 },
  );
  const [search, setSearch] = useState("");
  const [filterItemType, setFilterItemType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [saving, setSaving] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

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

  // Fetch on mount (skip if server-prefetched)
  useEffect(() => {
    if (initialItems.length > 0) return;
    fetchItems(1, "", "", false);
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch on filter/search change (debounced)
  useEffect(() => {
    if (!search && !filterItemType && !showArchived) return;
    const timer = setTimeout(() => {
      fetchItems(1, search, filterItemType, showArchived);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterItemType, showArchived, fetchItems]);

  // Compute stats client-side
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
                onChange={setSearch}
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
