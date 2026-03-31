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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconDots, IconEdit, IconTrash } from "@tabler/icons-react";

export interface AgreementRow {
  id: string;
  contractName: string;
  customerId: string;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  equipmentId?: string | null;
  equipmentType?: string | null;
  equipmentBrand?: string | null;
  startDate: string;
  endDate: string;
  frequency: string | null;
  visitsPerYear: number | null;
  annualPrice: string | null;
  isActive: boolean | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ServiceAgreementTableProps {
  agreements: AgreementRow[];
  onEdit: (agreement: AgreementRow) => void;
  onDelete: (agreement: AgreementRow) => void;
  showCustomer?: boolean;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(val: string | null) {
  if (!val) return "—";
  const num = parseFloat(val);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  annual: "Annual",
};

function getStatus(isActive: boolean | null, endDate: string) {
  const now = new Date();
  const end = new Date(endDate);
  const daysUntilEnd = Math.ceil(
    (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (!isActive) {
    return {
      label: "Inactive",
      className:
        "bg-gray-50 text-gray-700 dark:bg-gray-950/40 dark:text-gray-300",
    };
  }
  if (daysUntilEnd < 0) {
    return {
      label: "Expired",
      className:
        "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    };
  }
  if (daysUntilEnd <= 30) {
    return {
      label: "Expiring Soon",
      className:
        "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }
  return {
    label: "Active",
    className:
      "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  };
}

export function ServiceAgreementTable({
  agreements,
  onEdit,
  onDelete,
  showCustomer = true,
}: ServiceAgreementTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Agreement</TableHead>
          {showCustomer && <TableHead>Customer</TableHead>}
          <TableHead className="hidden md:table-cell">Asset</TableHead>
          <TableHead className="hidden lg:table-cell">Period</TableHead>
          <TableHead>Frequency</TableHead>
          <TableHead className="hidden md:table-cell">Price/Year</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {agreements.map((agreement) => {
          const status = getStatus(agreement.isActive, agreement.endDate);

          return (
            <TableRow key={agreement.id}>
              <TableCell>
                <span className="font-medium text-foreground">
                  {agreement.contractName}
                </span>
              </TableCell>
              {showCustomer && (
                <TableCell className="text-muted-foreground">
                  {agreement.customerFirstName && agreement.customerLastName
                    ? `${agreement.customerFirstName} ${agreement.customerLastName}`
                    : "—"}
                </TableCell>
              )}
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {agreement.equipmentType
                  ? [agreement.equipmentType, agreement.equipmentBrand]
                      .filter(Boolean)
                      .join(" — ")
                  : "—"}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                {formatDate(agreement.startDate)} — {formatDate(agreement.endDate)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {agreement.frequency
                  ? frequencyLabels[agreement.frequency] ?? agreement.frequency
                  : "—"}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {formatCurrency(agreement.annualPrice)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={status.className}>
                  {status.label}
                </Badge>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <IconDots className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(agreement)}>
                      <IconEdit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(agreement)}
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
