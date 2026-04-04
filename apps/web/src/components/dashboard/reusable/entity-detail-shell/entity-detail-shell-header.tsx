"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  IconLayoutSidebar,
  IconMaximize,
  IconExternalLink,
  IconTrash,
  IconX,
} from "@tabler/icons-react";

interface EntityDetailShellHeaderProps {
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
  return (
    <div className="px-6 pt-5 pb-3 border-b border-border">
      <div className="flex items-start justify-between">
        {/* Left: title + badges + description */}
        <div className="min-w-0 flex-1 pr-2">
          {renderTitle()}
          {renderDescription && (
            <div className="mt-1 text-sm text-muted-foreground/80 font-body">
              {renderDescription()}
            </div>
          )}
        </div>

        {/* Right: toolbar button group */}
        <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer hover:bg-muted"
            onClick={onToggleMode}
            title={
              mode === "sidebar"
                ? "Switch to dialog view"
                : "Switch to sidebar view"
            }
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
            className="h-7 w-7 cursor-pointer hover:bg-muted"
            onClick={onOpenFullPage}
            title={`Open ${entityLabel.toLowerCase()} full page`}
          >
            <IconExternalLink className="h-3.5 w-3.5" />
          </Button>

          {renderToolbarExtras?.()}

          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
              title={`Delete ${entityLabel.toLowerCase()}`}
            >
              <IconTrash className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer hover:bg-muted"
            onClick={onClose}
            title="Close"
          >
            <IconX className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Action buttons row */}
      {renderActions && (
        <div className="flex items-center gap-2 pt-3">{renderActions()}</div>
      )}
    </div>
  );
}
