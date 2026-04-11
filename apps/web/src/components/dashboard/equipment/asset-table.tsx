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
import { IconDots, IconEdit, IconTrash } from "@tabler/icons-react";

export interface AssetRow {
  id: string;
  equipmentType: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  installDate: string | null;
  warrantyExpiry: string | null;
  location: string | null;
  notes: string | null;
  customerId: string;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AssetTableProps {
  assets: AssetRow[];
  onEdit: (asset: AssetRow) => void;
  onDelete: (asset: AssetRow) => void;
  onRowClick?: (asset: AssetRow) => void;
  showCustomer?: boolean;
  // Selection props (optional)
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: (items: { id: string }[]) => void;
  isAllSelected?: boolean;
  isIndeterminate?: boolean;
}

function getWarrantyStatus(warrantyExpiry: string | null) {
  if (!warrantyExpiry) return null;

  const expiry = new Date(warrantyExpiry);
  const now = new Date();
  const daysUntilExpiry = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilExpiry < 0) {
    return { label: "Expired", variant: "destructive" as const };
  }
  if (daysUntilExpiry <= 90) {
    return { label: "Expiring Soon", variant: "secondary" as const };
  }
  return { label: "Under Warranty", variant: "default" as const };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AssetTable({
  assets,
  onEdit,
  onDelete,
  onRowClick,
  showCustomer = false,
  selectedIds,
  onToggle,
  onToggleAll,
  isAllSelected,
  isIndeterminate,
}: AssetTableProps) {
  const selectionEnabled = !!selectedIds && !!onToggle;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectionEnabled && (
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
                onCheckedChange={() => onToggleAll?.(assets)}
                aria-label="Select all"
              />
            </TableHead>
          )}
          <TableHead>Type</TableHead>
          {showCustomer && <TableHead>Customer</TableHead>}
          <TableHead>Brand / Model</TableHead>
          <TableHead className="hidden md:table-cell">Serial #</TableHead>
          <TableHead className="hidden lg:table-cell">Install Date</TableHead>
          <TableHead>Warranty</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => {
          const warranty = getWarrantyStatus(asset.warrantyExpiry);

          return (
            <TableRow
              key={asset.id}
              className={onRowClick ? "cursor-pointer" : ""}
              onClick={() => onRowClick?.(asset)}
              data-selected={selectionEnabled && selectedIds?.has(asset.id)}
            >
              {selectionEnabled && (
                <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds?.has(asset.id) ?? false}
                    onCheckedChange={() => onToggle(asset.id)}
                    aria-label={`Select ${asset.equipmentType}`}
                  />
                </TableCell>
              )}
              <TableCell>
                <div>
                  <span className="font-medium text-foreground">
                    {asset.equipmentType}
                  </span>
                  {asset.location && (
                    <p className="text-xs text-muted-foreground">
                      {asset.location}
                    </p>
                  )}
                </div>
              </TableCell>
              {showCustomer && (
                <TableCell className="text-muted-foreground">
                  {asset.customerFirstName && asset.customerLastName
                    ? `${asset.customerFirstName} ${asset.customerLastName}`
                    : "—"}
                </TableCell>
              )}
              <TableCell className="text-muted-foreground">
                {asset.brand || asset.model
                  ? [asset.brand, asset.model].filter(Boolean).join(" ")
                  : "—"}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {asset.serialNumber ?? "—"}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">
                {formatDate(asset.installDate)}
              </TableCell>
              <TableCell>
                {warranty ? (
                  <Badge variant={warranty.variant}>{warranty.label}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <IconDots className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(asset)}>
                      <IconEdit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(asset)}
                      className="text-destructive focus:text-destructive"
                    >
                      <IconTrash className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
