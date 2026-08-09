"use client";

import { getDefinition, outputsFor } from "@hvac-saas/workflow-nodes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBuilderStore } from "@/lib/workflow/store";

/**
 * Deleting a branching step (X-4).
 *
 * Deleting a step normally reconnects its neighbours, so the chain closes up
 * and nothing is lost. A step with several outgoing branches has **no single
 * successor to promote** — so its connections are dropped and everything on
 * both paths is left orphaned.
 *
 * That is the right behaviour: guessing which branch to keep would be the tool
 * making an editorial decision about the user's automation. But it must not be
 * silent, because the graph still *looks* connected at a glance and the loss
 * shows up later as steps that never run.
 *
 * Only a genuine fork asks. One outgoing edge relinks cleanly and none severs
 * nothing — prompting there is how people learn to dismiss prompts unread.
 */
export function BranchDeleteDialog() {
  const nodeId = useBuilderStore((s) => s.pendingDeleteNodeId);
  const nodes = useBuilderStore((s) => s.nodes);
  const edges = useBuilderStore((s) => s.edges);
  const confirm = useBuilderStore((s) => s.confirmPendingDelete);
  const cancel = useBuilderStore((s) => s.cancelPendingDelete);

  const node = nodeId ? nodes.find((n) => n.id === nodeId) : null;
  const definition = node ? getDefinition(node.nodeType) : undefined;
  const branchOutputs =
    node && definition
      ? outputsFor(definition, node.nodeConfig.parameters ?? {})
      : [];

  // Named rather than counted. "Yes and No will be disconnected" is something a
  // person can picture; "2 branches will be disconnected" is arithmetic.
  const branchLabels = node
    ? edges
        .filter((e) => e.sourceNodeId === node.id)
        .map(
          (e) =>
            branchOutputs.find((o) => o.id === e.sourceHandle)?.label ??
            e.sourceHandle,
        )
    : [];
  const unique = [...new Set(branchLabels)];

  return (
    <AlertDialog open={!!node} onOpenChange={(open) => !open && cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">
            Delete &ldquo;{node?.nodeConfig.label}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription className="font-body">
            This step splits the automation, so deleting it can&rsquo;t join the
            paths back up.{" "}
            {unique.length > 0 && (
              <>
                Everything after{" "}
                <strong className="font-medium text-foreground">
                  {unique.length === 1
                    ? unique[0]
                    : `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`}
                </strong>{" "}
                will be left disconnected.
              </>
            )}{" "}
            You can undo this.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="font-body">Keep it</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
          >
            Delete the step
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
