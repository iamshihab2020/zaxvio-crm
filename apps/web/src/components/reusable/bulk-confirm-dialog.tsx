"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle } from "@tabler/icons-react";

interface BulkConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
  title: string;
  description: string;
  warning?: string;
  confirmLabel?: string;
  variant?: "destructive" | "default";
}

export function BulkConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  title,
  description,
  warning,
  confirmLabel = "Confirm",
  variant = "destructive",
}: BulkConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-start gap-4 pt-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{description}</p>
                {warning && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    {warning}
                  </p>
                )}
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            disabled={loading}
            className="min-w-[100px]"
          >
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
