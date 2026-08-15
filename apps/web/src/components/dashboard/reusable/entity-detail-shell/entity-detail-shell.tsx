"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconPlugConnectedX, IconRefresh } from "@tabler/icons-react";
import { useDetailShell } from "./use-detail-shell";
import { EntityDetailShellHeader } from "./entity-detail-shell-header";
import { EntityDetailShellSkeleton } from "./entity-detail-shell-skeleton";
import type { EntityDetailShellProps } from "./types";

export function EntityDetailShell({
  entityType,
  entityRoute,
  entityLabel,
  entityId,
  open,
  onOpenChange,
  loading,
  hasData,
  loadError,
  onRetry,
  renderTitle,
  renderDescription,
  renderActions,
  renderToolbarExtras,
  onDelete,
  tabs,
  children,
}: EntityDetailShellProps) {
  const {
    mode,
    liveSidebarWidth,
    toggleMode,
    handleOpenChange,
    handleDragStart,
    navigateToFullPage,
  } = useDetailShell(entityType, entityRoute, onOpenChange);

  const [activeTab, setActiveTab] = useState(tabs?.[0]?.value ?? "details");

  // Reset active tab when data loads or entity changes
  useEffect(() => {
    if (hasData && tabs?.length) {
      setActiveTab(tabs[0].value);
    }
  }, [entityId, hasData]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Inner content (shared between dialog and sidebar) ───── */
  const innerContent = (
    <>
      {loading && (
        <>
          {mode === "dialog" ? (
            <>
              <DialogTitle className="sr-only">
                {entityLabel} details
              </DialogTitle>
              <DialogDescription className="sr-only">
                Loading {entityLabel.toLowerCase()} information
              </DialogDescription>
            </>
          ) : (
            <>
              <SheetTitle className="sr-only">
                {entityLabel} details
              </SheetTitle>
              <SheetDescription className="sr-only">
                Loading {entityLabel.toLowerCase()} information
              </SheetDescription>
            </>
          )}
          <EntityDetailShellSkeleton />
        </>
      )}

      {!loading && !hasData && loadError && (
        <>
          {mode === "dialog" ? (
            <>
              <DialogTitle className="sr-only">
                {entityLabel} could not be loaded
              </DialogTitle>
              <DialogDescription className="sr-only">
                {loadError}
              </DialogDescription>
            </>
          ) : (
            <>
              <SheetTitle className="sr-only">
                {entityLabel} could not be loaded
              </SheetTitle>
              <SheetDescription className="sr-only">
                {loadError}
              </SheetDescription>
            </>
          )}
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-3 p-10 text-center"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <IconPlugConnectedX
                className="h-5 w-5 text-muted-foreground"
                aria-hidden
              />
            </div>
            <div>
              <p className="font-heading text-base font-semibold text-foreground">
                Couldn&apos;t load this {entityLabel.toLowerCase()}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <IconRefresh className="mr-1.5 h-4 w-4" aria-hidden />
                Try again
              </Button>
            )}
          </div>
        </>
      )}

      {!loading && hasData && (
        <>
          {/* Aria labels */}
          {mode === "dialog" ? (
            <>
              <DialogTitle className="sr-only">
                {entityLabel} details
              </DialogTitle>
              <DialogDescription className="sr-only">
                {entityLabel} detail view
              </DialogDescription>
            </>
          ) : (
            <>
              <SheetTitle className="sr-only">
                {entityLabel} details
              </SheetTitle>
              <SheetDescription className="sr-only">
                {entityLabel} detail view
              </SheetDescription>
            </>
          )}

          {/* Header */}
          <EntityDetailShellHeader
            mode={mode}
            entityLabel={entityLabel}
            renderTitle={renderTitle}
            renderDescription={renderDescription}
            renderActions={renderActions}
            renderToolbarExtras={renderToolbarExtras}
            onToggleMode={toggleMode}
            onOpenFullPage={() => entityId && navigateToFullPage(entityId)}
            onClose={() => onOpenChange(false)}
            onDelete={onDelete}
          />

          {/* Tabbed content */}
          {tabs && tabs.length > 0 && (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1"
            >
              <TabsList className="w-full justify-start overflow-x-auto px-6 pt-2">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-1.5 text-[10px] px-1.5 py-0 rounded-full min-w-[18px] text-center"
                      >
                        {tab.count}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="px-6 py-5">
                {tabs.map((tab) => (
                  <TabsContent key={tab.value} value={tab.value} className="mt-0">
                    {activeTab === tab.value && tab.content}
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          )}

          {/* Direct content (non-tabbed) */}
          {!tabs && children && (
            <div className="px-6 py-5">{children}</div>
          )}
        </>
      )}
    </>
  );

  /* ── Dialog mode ─────────────────────────────────────────── */
  if (mode === "dialog") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0">
          {innerContent}
        </DialogContent>
      </Dialog>
    );
  }

  /* ── Sidebar mode (default) ──────────────────────────────── */
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="overflow-y-auto p-0"
        style={{
          maxWidth: liveSidebarWidth,
          width: "100%",
        }}
      >
        {/* Drag handle — left edge resize */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group"
          onMouseDown={handleDragStart}
        >
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-brand/40 transition-colors" />
        </div>
        {innerContent}
      </SheetContent>
    </Sheet>
  );
}
