"use client";

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
}

const itemTypeBadgeStyles: Record<string, string> = {
  labor: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  part: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  material: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  service_call: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

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
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Unit Price</TableHead>
          <TableHead>Unit</TableHead>
          {showArchived && <TableHead>Status</TableHead>}
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow
            key={item.id}
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
            <TableCell className="font-medium text-foreground">
              {item.name}
            </TableCell>
            <TableCell>
              <Badge
                variant="secondary"
                className={itemTypeBadgeStyles[item.itemType] ?? ""}
              >
                {itemTypeLabels[item.itemType] ?? item.itemType}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {item.category || "\u2014"}
            </TableCell>
            <TableCell className="text-right text-foreground">
              {priceFormatter.format(Number(item.unitPrice))}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {item.unit || "each"}
            </TableCell>
            {showArchived && (
              <TableCell>
                <Badge
                  variant="secondary"
                  className={
                    item.isActive
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
                  }
                >
                  {item.isActive ? "Active" : "Archived"}
                </Badge>
              </TableCell>
            )}
            <TableCell onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
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
