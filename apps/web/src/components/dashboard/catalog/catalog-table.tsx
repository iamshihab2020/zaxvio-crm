"use client";

import type { Ref } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconDots,
  IconEdit,
  IconTrash,
  IconArchive,
  IconArchiveOff,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { CatalogItem } from "@hvac-saas/types";

interface CatalogTableProps {
  items: CatalogItem[];
  showArchived: boolean;
  onEdit: (item: CatalogItem) => void;
  onArchiveToggle: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
  // Selection props (optional)
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: (items: { id: string }[]) => void;
  isAllSelected?: boolean;
  isIndeterminate?: boolean;
  /** The page owns the ref so it can stagger the rows when the view changes (`useStagger`). */
  bodyRef?: Ref<HTMLTableSectionElement>;
  /** A row that was just created or edited; it flashes once (`useRowFlash`). */
  highlightId?: string | null;
}

const itemTypeBadgeStyles: Record<string, string> = {
  labor: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  part: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  material: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  service_call: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

// Used by the Status column and by the same badge folded under the name on a
// phone, so the two cannot drift apart.
const activeBadgeStyle =
  "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
const archivedBadgeStyle =
  "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";

const itemTypeLabels: Record<string, string> = {
  labor: "Labor",
  part: "Part",
  material: "Material",
  service_call: "Service Call",
  other: "Other",
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function CatalogTable({
  items,
  showArchived,
  onEdit,
  onArchiveToggle,
  onDelete,
  selectedIds,
  onToggle,
  onToggleAll,
  isAllSelected,
  isIndeterminate,
  bodyRef,
  highlightId,
}: CatalogTableProps) {
  const selectionEnabled = !!selectedIds && !!onToggle;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectionEnabled && (
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
                onCheckedChange={() => onToggleAll?.(items)}
                aria-label="Select all"
              />
            </TableHead>
          )}
          {/* A phone gets the name (type, unit and archived state folded under
              it) and the price. Type, unit and status arrive at `md`, category
              at `lg`. */}
          <TableHead className="px-2 sm:px-4">Name</TableHead>
          <TableHead className="hidden md:table-cell">Type</TableHead>
          <TableHead className="hidden lg:table-cell">Category</TableHead>
          <TableHead className="px-2 text-right sm:px-4">Unit Price</TableHead>
          <TableHead className="hidden md:table-cell">Unit</TableHead>
          {showArchived && <TableHead className="hidden md:table-cell">Status</TableHead>}
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody ref={bodyRef}>
        {items.map((item) => (
          <TableRow
            key={item.id}
            className={cn(item.id === highlightId && "motion-highlight")}
            data-selected={selectionEnabled && selectedIds?.has(item.id)}
          >
            {selectionEnabled && (
              <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds?.has(item.id) ?? false}
                  onCheckedChange={() => onToggle(item.id)}
                  aria-label={`Select ${item.name}`}
                />
              </TableCell>
            )}
            <TableCell className="px-2 font-medium text-foreground sm:px-4">
              {item.name}
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-normal md:hidden">
                <Badge
                  variant="secondary"
                  className={itemTypeBadgeStyles[item.itemType] ?? ""}
                >
                  {itemTypeLabels[item.itemType] ?? item.itemType}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {item.unit && item.unit !== "each" ? `per ${item.unit}` : "each"}
                </span>
                {showArchived && (
                  <Badge
                    variant="secondary"
                    className={item.isActive ? activeBadgeStyle : archivedBadgeStyle}
                  >
                    {item.isActive ? "Active" : "Archived"}
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <Badge
                variant="secondary"
                className={itemTypeBadgeStyles[item.itemType] ?? ""}
              >
                {itemTypeLabels[item.itemType] ?? item.itemType}
              </Badge>
            </TableCell>
            <TableCell className="hidden text-muted-foreground lg:table-cell">
              {item.category || "\u2014"}
            </TableCell>
            {/* Cost under the price, as on a job's line items. "No cost" is
                said out loud — a blank cell reads as free, and an item costing
                nothing reports 100% margin on every job it touches. */}
            <TableCell className="px-2 text-right text-foreground sm:px-4">
              <div className="tnum">
                {priceFormatter.format(Number(item.unitPrice))}
              </div>
              {item.unitCost ? (
                <div className="tnum font-mono text-[11px] text-muted-foreground">
                  cost {priceFormatter.format(Number(item.unitCost))}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground/70">
                  no cost
                </div>
              )}
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">
              {item.unit || "each"}
            </TableCell>
            {showArchived && (
              <TableCell className="hidden md:table-cell">
                <Badge
                  variant="secondary"
                  className={item.isActive ? activeBadgeStyle : archivedBadgeStyle}
                >
                  {item.isActive ? "Active" : "Archived"}
                </Badge>
              </TableCell>
            )}
            <TableCell className="px-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8">
                    <IconDots className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(item)}>
                    <IconEdit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onArchiveToggle(item)}>
                    {item.isActive ? (
                      <>
                        <IconArchive className="mr-2 h-4 w-4" />
                        Archive
                      </>
                    ) : (
                      <>
                        <IconArchiveOff className="mr-2 h-4 w-4" />
                        Restore
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(item)}
                    className="text-destructive focus:text-destructive"
                  >
                    <IconTrash className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
