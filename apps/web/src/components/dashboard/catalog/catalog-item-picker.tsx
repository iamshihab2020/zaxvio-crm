"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { IconSelector, IconCheck, IconX } from "@tabler/icons-react";
import { getCatalogItems } from "@/actions/catalog";

export interface CatalogPickerItem {
  id: string;
  name: string;
  category: string | null;
  unitPrice: string;
  itemType: string;
}

interface CatalogItemPickerProps {
  selectedId: string | null;
  selectedLabel: string;
  onSelect: (item: CatalogPickerItem | null) => void;
  placeholder?: string;
}

export function CatalogItemPicker({
  selectedId,
  selectedLabel,
  onSelect,
  placeholder = "Link catalog item...",
}: CatalogItemPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CatalogPickerItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async (q: string) => {
    setLoading(true);
    const result = await getCatalogItems({ search: q, limit: 10 });
    if (result.data) {
      setItems(
        result.data.map((c: CatalogPickerItem) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          unitPrice: c.unitPrice,
          itemType: c.itemType,
        })),
      );
    }
    setLoading(false);
  }, []);

  // Prefetch catalog items on mount so data is ready instantly
  useEffect(() => {
    fetchItems("");
  }, [fetchItems]);

  // Refetch when user searches inside the popover
  useEffect(() => {
    if (!open || search === "") return;
    const timer = setTimeout(() => fetchItems(search), 300);
    return () => clearTimeout(timer);
  }, [search, open, fetchItems]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm font-body cursor-pointer",
            !selectedId && "text-muted-foreground",
          )}
        >
          <span className="truncate">
            {selectedId ? selectedLabel : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selectedId && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(null);
                }}
                className="rounded-sm hover:bg-muted p-0.5"
              >
                <IconX className="h-3 w-3 text-muted-foreground" />
              </span>
            )}
            <IconSelector className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search catalog..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Searching..." : "No catalog items found"}
            </CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {selectedId === item.id ? (
                      <IconCheck className="h-4 w-4 text-brand shrink-0" />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      {item.category && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.category}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground shrink-0">
                      ${parseFloat(item.unitPrice).toFixed(2)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
