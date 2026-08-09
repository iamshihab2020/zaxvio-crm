"use client";

import { useState } from "react";
import { IconCheck, IconRotate } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { ConfirmActionDialog } from "@/components/reusable/confirm-action-dialog";
import { useWorkflowVersions, useRestoreWorkflowVersion } from "@/hooks/queries";
import { useTenantTimezone } from "@/hooks/queries/use-tenant";
import { formatExact, formatRelative } from "../runs/run-timing";
import { cn } from "@/lib/utils";

/**
 * Every version this automation has been published as.
 *
 * `GET /:id/versions` and `useWorkflowVersions` both existed and neither had a
 * consumer — an audit found the hook with zero callers, and the reason was that
 * a list of versions with no way to use one is a museum. The restore endpoint is
 * what makes this worth opening.
 *
 * **Restoring puts a version back on the canvas, it does not make it live.**
 * The wording throughout says so, because the natural reading of "restore" is
 * "undo the damage now" and that is not what happens — the user still has to
 * look at it and press Publish. Publishing then mints a *new* version, so the
 * history stays a true record of what was live and when.
 */

interface Props {
  workflowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The concurrency token — restore is a save and carries the same check. */
  expectedUpdatedAt: string | null;
  /**
   * Called only when a restore actually landed.
   *
   * Separate from `onOpenChange` on purpose: the builder has to force its store
   * to reload the graph, and doing that on every close would discard whatever
   * the user had drawn since — for somebody who opened the sheet, looked, and
   * closed it again.
   */
  onRestored: () => void;
}

export function VersionHistorySheet({
  workflowId,
  open,
  onOpenChange,
  expectedUpdatedAt,
  onRestored,
}: Props) {
  const query = useWorkflowVersions(workflowId, open);
  const restoreMutation = useRestoreWorkflowVersion();
  const timezone = useTenantTimezone();

  const [confirming, setConfirming] = useState<{ id: string; version: number } | null>(
    null,
  );

  const versions = query.data?.data ?? [];
  const error = query.isError ? "Couldn't reach the server." : query.data?.error;

  function restore() {
    if (!confirming || !expectedUpdatedAt) return;
    restoreMutation.mutate(
      { id: workflowId, versionId: confirming.id, expectedUpdatedAt },
      {
        onSuccess: (res) => {
          if (res.error) return;
          setConfirming(null);
          onOpenChange(false);
          onRestored();
        },
      },
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-6 py-4 text-left">
            <SheetTitle className="font-heading">Version history</SheetTitle>
            <SheetDescription className="font-body">
              Every time this automation was published. Restoring puts a version
              back on your canvas — it doesn&apos;t make it live on its own.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {query.isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            )}

            {error && (
              <LoadErrorState
                title="Couldn't load the history"
                message={error}
                onRetry={() => query.refetch()}
                isRetrying={query.isFetching}
              />
            )}

            {!query.isLoading && !error && versions.length === 0 && (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground font-body">
                This automation hasn&apos;t been published yet, so there is no
                history to show.
              </p>
            )}

            <ol className="space-y-2">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className={cn(
                    "rounded-lg border bg-card p-3",
                    version.isActive ? "border-brand/50" : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">
                          v{version.version}
                        </span>
                        {/* The live one is `active_version_id`, NOT the highest
                            number — they differ the moment somebody restores an
                            older version and publishes it. */}
                        {version.isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand font-body">
                            <IconCheck className="h-3 w-3" />
                            Live
                          </span>
                        )}
                      </div>
                      <p
                        className="mt-0.5 text-xs text-muted-foreground font-body"
                        title={formatExact(version.publishedAt, timezone) ?? undefined}
                      >
                        {formatRelative(version.publishedAt)} ·{" "}
                        {version.nodeCount} {version.nodeCount === 1 ? "step" : "steps"}
                      </p>
                      {version.note && (
                        <p className="mt-1 text-sm font-body">{version.note}</p>
                      )}
                    </div>

                    {/* No Restore on the live version: it is already what the
                        engine runs, and offering the action would imply it is
                        not. */}
                    {!version.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={!expectedUpdatedAt || restoreMutation.isPending}
                        onClick={() =>
                          setConfirming({ id: version.id, version: version.version })
                        }
                      >
                        <IconRotate className="mr-1.5 h-3.5 w-3.5" />
                        Restore
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmed, because it overwrites the canvas. Whatever the user has
          drawn since — saved or not — is replaced, and that is not something to
          discover after the fact. */}
      <ConfirmActionDialog
        open={confirming !== null}
        onOpenChange={(next) => {
          if (!next) setConfirming(null);
        }}
        title={`Put version ${confirming?.version} back on the canvas?`}
        description="This replaces what's on your canvas now. It doesn't change what's running — you'll still need to press Publish."
        confirmLabel="Restore it"
        onConfirm={restore}
        loading={restoreMutation.isPending}
      />
    </>
  );
}
