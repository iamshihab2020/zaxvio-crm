"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Column<T> {
  key: keyof T;
  label: string;
  align?: "left" | "right";
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface ReportDataTableProps<T> {
  title: string;
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

export function ReportDataTable<T extends Record<string, unknown>>({
  title,
  columns,
  data,
  emptyMessage = "No data available",
}: ReportDataTableProps<T>) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-sm font-semibold">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {data.length === 0 ? (
          <div className="flex h-20 items-center justify-center px-6 pb-4">
            <p className="text-sm text-muted-foreground font-body">
              {emptyMessage}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={String(col.key)}
                    className={
                      col.align === "right" ? "text-right" : "text-left"
                    }
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell
                      key={String(col.key)}
                      className={
                        col.align === "right" ? "text-right" : "text-left"
                      }
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
