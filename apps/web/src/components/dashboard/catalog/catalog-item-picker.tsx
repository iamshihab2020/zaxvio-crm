"use client";

import { useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCatalogItems } from "@/hooks/queries";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconSelector, IconCheck, IconX } from "@tabler/icons-react";

export interface CatalogPickerItem {
  id: string;
  name: string;
  category: string | null;
  unitPrice: string;
  /** What the item costs the business. Null when nobody has costed it. */
  unitCost: string | null;
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
  const debouncedSearch = useDebouncedValue(search, 300);

  /**
   * Reads through TanStack Query instead of calling the server action directly.
   *
   * What was wrong: this fetched on **mount** with a bare server action and no
   * cache. `CatalogItemPicker` mounts once per line item, and the Create Quote
   * dialog also mounts `CustomerPicker` and `AssetPicker`, each doing the same
   * thing. Next.js queues server actions, so those uncached round trips ran one
   * after another — Next → Fastify → Neon each time — and the one the user
   * actually opened waited behind the ones they didn't. Every re-open of the
   * dialog paid the whole cost again.
   *
   * Now: nothing fetches until the popover opens, identical queries dedupe
   * across every picker on the page, and the result is cached for a minute —
   * the catalog is reference data, not a live feed.
   */
  const itemsQuery = useCatalogItems(
    { search: debouncedSearch || undefined, limit: 10 },
    { enabled: open },
  );

  const items = ((itemsQuery.data?.data ?? []) as CatalogPickerItem[]).map(
    (c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      unitPrice: c.unitPrice,
      unitCost: c.unitCost ?? null,
      itemType: c.itemType,
    }),
  );
  // Only a first load is worth a "Searching..." — a background refetch of an
  // already-populated list should not blank the results out.
  const loading = itemsQuery.isPending && open;

  /**
   * `modal` on the Popover, because this picker opens inside the Create Job and
   * Create Quote dialogs.
   *
   * A Radix Dialog mounts react-remove-scroll with its own content as the only
   * scrollable shard, and a Popover renders in a portal *outside* that subtree.
   * The wheel event over this list was therefore swallowed and the results
   * would not scroll — with a visible scrollbar sitting right there, which made
   * it read as a broken list rather than a locked one. A modal Popover
   * registers its own content as a shard, which re-permits the wheel.
   */
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 w-full justify-between font-body",
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
        </Button>
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
