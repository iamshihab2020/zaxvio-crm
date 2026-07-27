"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getCustomer } from "@/actions/customers";
import { formatPhoneDisplay } from "@/lib/phone";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  IconArchiveOff,
  IconArrowUp,
  IconArrowDown,
  IconArrowsSort,
} from "@tabler/icons-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Customer } from "@hvac-saas/types";

type SortKey = "createdAt" | "firstName" | "lastName" | "email";

interface CustomerTag {
  id: string;
  name: string;
  color: string | null;
}

/** Customer rows may carry their tags when the API includes them. */
type CustomerRow = Customer & { tags?: CustomerTag[] };

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(first: string, last: string): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

interface CustomerTableProps {
  customers: CustomerRow[];
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  /** Only supplied on the Archived tab (CUST-23). */
  onRestore?: (customer: Customer) => void;
  onTagClick?: (tag: { id: string; name: string }) => void;
  showingArchived?: boolean;
  sortBy?: SortKey;
  sortOrder?: "asc" | "desc";
  onSortChange?: (key: SortKey) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  isAllSelected?: boolean;
  isIndeterminate?: boolean;
}

/**
 * A sortable column header.
 *
 * The API and the server action supported four sort columns the whole time and
 * the table rendered plain text, so there was no way to reach any of it (CUST-24).
 */
function SortableHead({
  label,
  sortKey,
  sortBy,
  sortOrder,
  onSortChange,
}: {
  label: string;
  sortKey: SortKey;
  sortBy?: SortKey;
  sortOrder?: "asc" | "desc";
  onSortChange?: (key: SortKey) => void;
}) {
  if (!onSortChange) {
    return <TableHead className="font-body">{label}</TableHead>;
  }
  const active = sortBy === sortKey;
  const Icon = !active ? IconArrowsSort : sortOrder === "asc" ? IconArrowUp : IconArrowDown;
  return (
    <TableHead className="font-body p-0">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onSortChange(sortKey)}
        className="h-auto w-full justify-start gap-1 px-4 py-3 font-body font-medium"
        aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <Icon
          className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground/40"}`}
          aria-hidden
        />
      </Button>
    </TableHead>
  );
}

export function CustomerTable({
  customers,
  onEdit,
  onDelete,
  onRestore,
  onTagClick,
  showingArchived = false,
  sortBy,
  sortOrder,
  onSortChange,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  isIndeterminate,
}: CustomerTableProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasSelection = !!selectedIds && !!onToggleSelect;

  function prefetchCustomer(id: string) {
    // Feeds `useCustomer`, which the detail page now actually reads — before, this
    // wrote to a cache key with no reader at all (CUST-14).
    queryClient.prefetchQuery({
      queryKey: queryKeys.customers.detail(id),
      queryFn: () => getCustomer(id),
      staleTime: 30_000,
    });
  }

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            {hasSelection && (
              <TableHead className="w-12" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
                  onCheckedChange={() => onToggleSelectAll?.()}
                  aria-label="Select all customers on this page"
                />
              </TableHead>
            )}
            <SortableHead
              label="Name"
              sortKey="lastName"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={onSortChange}
            />
            <SortableHead
              label="Email"
              sortKey="email"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={onSortChange}
            />
            <TableHead className="font-body">Phone</TableHead>
            <TableHead className="font-body">Location</TableHead>
            <SortableHead
              label="Added"
              sortKey="createdAt"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={onSortChange}
            />
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow
              key={customer.id}
              className="cursor-pointer"
              onClick={() => router.push(`/customers/${customer.id}`)}
              onMouseEnter={() => prefetchCustomer(customer.id)}
            >
              {hasSelection && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(customer.id)}
                    onCheckedChange={() => onToggleSelect(customer.id)}
                    aria-label={`Select ${customer.firstName} ${customer.lastName}`}
                  />
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-brand-light text-brand text-xs font-heading">
                      {getInitials(customer.firstName, customer.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    {/*
                      A real link, not just a row click. The row was the only way
                      to open a customer and it was a bare onClick with no
                      tabIndex, role or key handler — so the detail page could not
                      be reached by keyboard at all (CUST-27). The row click stays
                      as an enhancement on top of this.
                    */}
                    <Link
                      href={`/customers/${customer.id}`}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={() => prefetchCustomer(customer.id)}
                      className="font-medium text-foreground hover:text-brand hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {customer.firstName} {customer.lastName}
                    </Link>
                    {showingArchived && (
                      <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Archived
                      </span>
                    )}
                    {customer.tags && customer.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {customer.tags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="h-4 cursor-pointer px-1.5 text-[10px] font-medium"
                            style={
                              tag.color
                                ? { backgroundColor: `${tag.color}20`, color: tag.color }
                                : undefined
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              onTagClick?.({ id: tag.id, name: tag.name });
                            }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {customer.email ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block max-w-[200px] truncate text-muted-foreground">
                        {customer.email}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{customer.email}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatPhoneDisplay(customer.phone) || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {[customer.city, customer.state].filter(Boolean).join(", ") || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(customer.createdAt)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconDots className="h-4 w-4" />
                      <span className="sr-only">
                        Actions for {customer.firstName} {customer.lastName}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onRestore && (
                      <DropdownMenuItem onClick={() => onRestore(customer)}>
                        <IconArchiveOff className="mr-2 h-4 w-4" />
                        Restore
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onEdit(customer)}>
                      <IconEdit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(customer)}
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
    </TooltipProvider>
  );
}
