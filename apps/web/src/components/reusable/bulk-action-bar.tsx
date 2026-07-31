"use client";

import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { IconX } from "@tabler/icons-react";

export interface BulkAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: BulkAction[];
  loading?: boolean;
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  actions,
  loading = false,
}: BulkActionBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          /* `x: "-50%"` is constant, not animated — it replaces the
             `-translate-x-1/2` class, which Framer would otherwise overwrite
             when it composes the `y` animation into the same transform. */
          initial={{ opacity: 0, y: 20, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 20, x: "-50%" }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-4 left-1/2 z-50 transition-[margin-left] duration-300 ease-in-out"
          /* Nudge right by half the sidebar so the bar is centred on the
             content, not on the viewport. `--sidebar-w` is published by
             DashboardShell; the 0px fallback degrades to viewport-centring
             anywhere the bar is used outside the dashboard. The transition
             matches the shell's, so it tracks collapse/expand. */
          style={{ marginLeft: "calc(var(--sidebar-w, 0px) / 2)" }}
        >
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 shadow-lg">
            <span className="text-sm font-medium text-foreground whitespace-nowrap">
              {selectedCount} selected
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={loading}
              className="h-7 px-2 text-muted-foreground"
            >
              <IconX className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>

            <Separator orientation="vertical" className="h-6" />

            {actions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant ?? "secondary"}
                size="sm"
                onClick={action.onClick}
                disabled={loading || action.disabled}
                className="h-7 whitespace-nowrap"
              >
                <action.icon className="mr-1.5 h-3.5 w-3.5" />
                {loading ? "Processing..." : action.label}
              </Button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
