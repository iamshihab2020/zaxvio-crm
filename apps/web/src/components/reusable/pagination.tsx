import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  entityName?: string;
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  entityName = "item",
}: PaginationProps) {
  return (
    // Phones stack: the count on its own line, then Previous / page / Next
    // spread across the width at 40px. One ~420px row doesn't fit 343px.
    <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground font-body">
        {total} {entityName}{total !== 1 ? "s" : ""} total
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-10 sm:h-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <IconChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-center text-sm text-muted-foreground font-body">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-10 sm:h-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <IconChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
