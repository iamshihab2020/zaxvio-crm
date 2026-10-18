"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  IconLayoutSidebar,
  IconMaximize,
  IconExternalLink,
  IconTrash,
  IconX,
} from "@tabler/icons-react";

interface EntityDetailShellHeaderProps {
  /** Lets the shell fade the header in when it replaces a skeleton. */
  className?: string;
  mode: "sidebar" | "dialog";
  entityLabel: string;

  renderTitle: () => ReactNode;
  renderDescription?: () => ReactNode;
  renderActions?: () => ReactNode;
  renderToolbarExtras?: () => ReactNode;

  onToggleMode: () => void;
  onOpenFullPage: () => void;
  onClose: () => void;
  onDelete?: () => void;
}

export function EntityDetailShellHeader({
  className,
  mode,
  entityLabel,
  renderTitle,
  renderDescription,
  renderActions,
  renderToolbarExtras,
  onToggleMode,
  onOpenFullPage,
  onClose,
  onDelete,
}: EntityDetailShellHeaderProps) {
  const toggleLabel =
    mode === "sidebar" ? "Switch to dialog view" : "Switch to sidebar view";
  const fullPageLabel = `Open ${entityLabel.toLowerCase()} full page`;
  const deleteLabel = `Delete ${entityLabel.toLowerCase()}`;

  return (
    <div
      className={cn(
        "px-4 pt-4 pb-3 border-b border-border sm:px-6 sm:pt-5",
        className,
      )}
    >
      {/* Wraps instead of squeezing: five 40px buttons leave a job number about
          120px on a phone, so the toolbar drops under the title whenever the
          title can't keep 10rem beside it. */}
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
        {/* Left: title + badges + description */}
        <div className="min-w-0 flex-1 basis-40 pr-2">
          {renderTitle()}
          {renderDescription && (
            <div className="mt-1 text-sm text-muted-foreground/80 font-body">
              {renderDescription()}
            </div>
          )}
        </div>

        {/* Right: toolbar button group — 40px targets on phones, dense from sm */}
        <div className="ml-auto flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 cursor-pointer hover:bg-muted sm:h-8 sm:w-8"
            onClick={onToggleMode}
            title={toggleLabel}
            aria-label={toggleLabel}
          >
            {mode === "sidebar" ? (
              <IconMaximize className="h-3.5 w-3.5" />
            ) : (
              <IconLayoutSidebar className="h-3.5 w-3.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 cursor-pointer hover:bg-muted sm:h-8 sm:w-8"
            onClick={onOpenFullPage}
            title={fullPageLabel}
            aria-label={fullPageLabel}
          >
            <IconExternalLink className="h-3.5 w-3.5" />
          </Button>

          {renderToolbarExtras?.()}

          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10 sm:h-8 sm:w-8"
              onClick={onDelete}
              title={deleteLabel}
              aria-label={deleteLabel}
            >
              <IconTrash className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 cursor-pointer hover:bg-muted sm:h-8 sm:w-8"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            <IconX className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Action buttons row — wraps so a long set (Send, Convert, Mark paid…)
          can't push the sheet sideways on a phone */}
      {renderActions && (
        <div className="flex flex-wrap items-center gap-2 pt-3">
          {renderActions()}
        </div>
      )}
    </div>
  );
}
