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
// ARC-12: `new Date("2026-08-01")` is UTC midnight, so every negative-offset
// timezone rendered the previous day. These are all `date` columns.
import { formatDateOnly as formatDate } from "@/lib/format";

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
          {/* Below `sm` the customer, brand/model and warranty fold under the
              type; five visible columns came to ~500px on a 343px screen. */}
          <TableHead>Type</TableHead>
          {showCustomer && <TableHead className="hidden sm:table-cell">Customer</TableHead>}
          <TableHead className="hidden sm:table-cell">Brand / Model</TableHead>
          <TableHead className="hidden md:table-cell">Serial #</TableHead>
          <TableHead className="hidden lg:table-cell">Install Date</TableHead>
          <TableHead className="hidden sm:table-cell">Warranty</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => {
          const warranty = getWarrantyStatus(asset.warrantyExpiry);
          const brandModel =
            asset.brand || asset.model
              ? [asset.brand, asset.model].filter(Boolean).join(" ")
              : null;
          const customerName =
            asset.customerFirstName && asset.customerLastName
              ? `${asset.customerFirstName} ${asset.customerLastName}`
              : null;

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
                  <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground sm:hidden">
                    {brandModel && <p>{brandModel}</p>}
                    {showCustomer && customerName && <p>{customerName}</p>}
                    {warranty && (
                      <Badge variant={warranty.variant} className="mt-0.5">
                        {warranty.label}
                      </Badge>
                    )}
                  </div>
                </div>
              </TableCell>
              {showCustomer && (
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {customerName ?? "—"}
                </TableCell>
              )}
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {brandModel ?? "—"}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {asset.serialNumber ?? "—"}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">
                {formatDate(asset.installDate)}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {warranty ? (
                  <Badge variant={warranty.variant}>{warranty.label}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="px-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8">
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
