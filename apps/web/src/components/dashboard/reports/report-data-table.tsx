"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WidgetErrorBoundary } from "@/components/reusable/widget-error-boundary";

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
  /** Stable identity per row. Falls back to the index only if omitted. */
  rowKey?: (row: T, index: number) => string;
  /** Makes rows clickable — the report is a starting point, not a dead end. */
  rowHref?: (row: T) => string;
}

export function ReportDataTable<T extends Record<string, unknown>>({
  title,
  columns,
  data,
  emptyMessage = "No data available",
  rowKey,
  rowHref,
}: ReportDataTableProps<T>) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-sm font-semibold">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <WidgetErrorBoundary name={title}>
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
                {data.map((row, i) => {
                  // Index keys made React reuse DOM across re-sorts, so a row's
                  // rendered content could lag its data. Rows carry real ids.
                  const key = rowKey ? rowKey(row, i) : String(i);
                  const href = rowHref?.(row);
                  return (
                    <TableRow key={key}>
                      {columns.map((col, ci) => {
                        const content = col.render
                          ? col.render(row[col.key], row)
                          : String(row[col.key] ?? "");
                        return (
                          <TableCell
                            key={String(col.key)}
                            className={
                              col.align === "right" ? "text-right" : "text-left"
                            }
                          >
                            {/* Only the first cell is a link. Wrapping every
                                cell would put N identical links per row in the
                                tab order and read them all out. */}
                            {href && ci === 0 ? (
                              <Link
                                href={href}
                                className="font-medium hover:underline"
                              >
                                {content}
                              </Link>
                            ) : (
                              content
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </WidgetErrorBoundary>
      </CardContent>
    </Card>
  );
}
