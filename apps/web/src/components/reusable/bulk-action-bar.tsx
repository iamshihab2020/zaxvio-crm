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
          /* `w-max` is load-bearing: a fixed box with `left: 50%` otherwise
             shrink-wraps into the right half of the screen, so on a phone the
             nowrap labels spilled out of a 187px bar. The cap keeps it inside
             the content area (the screen minus the sidebar, 0 below `lg`).
             `max-md:bottom-24` lifts it over the help chatbot's launcher (a
             56px button at bottom-6 right-6): on a phone the bar is nearly the
             screen's width, so at bottom-4 the launcher sat on its last action. */
          className="fixed bottom-4 left-1/2 z-50 w-max max-md:bottom-24 max-w-[calc(100vw_-_var(--sidebar-w,0px)_-_1rem)] transition-[margin-left] duration-300 ease-in-out"
          /* Nudge right by half the sidebar so the bar is centred on the
             content, not on the viewport. `--sidebar-w` is published by
             DashboardShell; the 0px fallback degrades to viewport-centring
             anywhere the bar is used outside the dashboard. The transition
             matches the shell's, so it tracks collapse/expand. */
          style={{ marginLeft: "calc(var(--sidebar-w, 0px) / 2)" }}
        >
          {/* Two rows on a phone: the count and Clear above, the actions
              wrapping below, labels kept (a jobs bar has one "move to stage"
              action per stage, all on the same icon, so icons alone would be
              indistinguishable). One row from `sm`. */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-lg sm:flex-row sm:items-center sm:px-4 sm:py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                {selectedCount} selected
              </span>

              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                disabled={loading}
                className="h-10 px-3 text-muted-foreground sm:h-7 sm:px-2"
              >
                <IconX className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            </div>

            <Separator
              orientation="vertical"
              className="hidden h-6 sm:block"
            />

            <div className="flex flex-wrap items-center gap-2">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  variant={action.variant ?? "secondary"}
                  size="sm"
                  onClick={action.onClick}
                  disabled={loading || action.disabled}
                  className="h-10 whitespace-nowrap sm:h-7"
                >
                  <action.icon className="mr-1.5 h-3.5 w-3.5" />
                  {loading ? "Processing..." : action.label}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
