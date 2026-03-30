"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { IconSearch, IconFilter, IconArchive, IconChevronDown, IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CATALOG_CATEGORIES } from "@/lib/constants/catalog-options";

interface CatalogFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  filterItemType: string;
  onFilterItemTypeChange: (value: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (value: string) => void;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
  categories: string[];
  totalItems?: number;
  action?: React.ReactNode;
}

const itemTypeOptions = [
  { value: "", label: "All Types" },
  { value: "labor", label: "Labor" },
  { value: "part", label: "Part" },
  { value: "material", label: "Material" },
  { value: "service_call", label: "Service Call" },
  { value: "other", label: "Other" },
];

export function CatalogFilters({
  search,
  onSearchChange,
  filterItemType,
  onFilterItemTypeChange,
  filterCategory,
  onFilterCategoryChange,
  showArchived,
  onShowArchivedChange,
  categories,
  totalItems,
  action,
}: CatalogFiltersProps) {
  const [typeOpen, setTypeOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const selectedTypeLabel =
    itemTypeOptions.find((o) => o.value === filterItemType)?.label ?? "All Types";

  const selectedCategoryLabel = filterCategory || "All Categories";

  const mergedCategories = useMemo(() => {
    const set = new Set<string>([...CATALOG_CATEGORIES, ...categories]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [categories]);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
      {/* Search */}
      <div className="relative max-w-sm">
        <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search catalog..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Item Type Filter */}
      <Popover open={typeOpen} onOpenChange={setTypeOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <IconFilter className="h-4 w-4" />
            {selectedTypeLabel}
            <IconChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[180px] p-1" align="start">
          {itemTypeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onFilterItemTypeChange(option.value);
                setTypeOpen(false);
              }}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                filterItemType === option.value && "bg-muted font-medium",
              )}
            >
              {option.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Category Filter */}
      <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" role="combobox" aria-expanded={categoryOpen}>
            {selectedCategoryLabel}
            <IconChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search categories..." />
            <CommandList>
              <CommandEmpty>No category found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="all-categories"
                  onSelect={() => {
                    onFilterCategoryChange("");
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
                      onFilterCategoryChange(val);
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

      {/* Show Archived Toggle */}
      <Button
        variant={showArchived ? "secondary" : "outline"}
        size="sm"
        onClick={() => onShowArchivedChange(!showArchived)}
        className="gap-1.5"
      >
        <IconArchive className="h-4 w-4" />
        {showArchived ? "Showing archived" : "Show archived"}
      </Button>

      <div className="ml-auto flex items-center gap-3">
        {totalItems !== undefined && (
          <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground font-body">
            {totalItems} {totalItems === 1 ? "Item" : "Items"}
          </span>
        )}
        {action}
      </div>
    </div>
  );
}
