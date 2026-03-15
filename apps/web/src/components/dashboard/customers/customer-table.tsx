"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconDots, IconEdit, IconTrash } from "@tabler/icons-react";
import type { Customer } from "@hvac-saas/types";

interface CustomerTableProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}

export function CustomerTable({ customers, onEdit, onDelete }: CustomerTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((customer) => (
          <TableRow key={customer.id}>
            <TableCell className="font-medium text-foreground">
              {customer.firstName} {customer.lastName}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {customer.email || "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {customer.phone || "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {[customer.city, customer.state].filter(Boolean).join(", ") || "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(customer.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <IconDots className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
  );
}
