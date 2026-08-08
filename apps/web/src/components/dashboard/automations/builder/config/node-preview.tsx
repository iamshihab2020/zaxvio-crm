"use client";

import { IconFlask, IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { usePreviewNode } from "@/hooks/queries";
import type { NodePreview } from "@/actions/workflows";
import { cn } from "@/lib/utils";

/**
 * "Test this step" (C-6 / A-10).
 *
 * **It resolves the step's settings. It does not run it.** Running `email.send`
 * to test it would put a real message in a customer's inbox, and a test button
 * that mails customers is one people learn not to press — which makes it worse
 * than no button.
 *
 * What actually goes wrong with a step is almost never the executor; it is a
 * mistyped `{{customer.frstName}}`, or a variable this trigger cannot provide,
 * or a subject that comes out blank. All of that is visible from the resolved
 * values, with no side effects.
 *
 * The button says "See what this would do" for the same reason. "Test" invites
 * the reading that something happened.
 */

interface Props {
  workflowId: string;
  nodeId: string;
  /** What to resolve against. Without one, variables resolve empty — which is
   *  itself worth showing, because a manual run would do the same. */
  subject?: { type: string; id: string };
  disabled?: boolean;
}

export function NodePreviewPanel({ workflowId, nodeId, subject, disabled }: Props) {
  const preview = usePreviewNode();
  const result = preview.data?.data ?? null;

  return (
    <div className="border-t border-border px-4 py-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full font-body"
        disabled={disabled || preview.isPending}
        onClick={() => preview.mutate({ id: workflowId, nodeId, subject })}
      >
        <IconFlask className="mr-1.5 h-3.5 w-3.5" />
        {preview.isPending ? "Working it out…" : "See what this would do"}
      </Button>

      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground font-body">
        Fills in the variables against a real record. Nothing is sent and nothing
        is saved.
      </p>

      {result && <PreviewResult result={result} />}
    </div>
  );
}

function PreviewResult({ result }: { result: NodePreview }) {
  const entries = Object.entries(result.parameters).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );

  return (
    <div className="mt-3 space-y-3">
      {/*
        Diagnostics first, and they are the reason this feature exists. An
        unresolved `{{token}}` renders as an empty string at run time — a blank
        line in a customer's email and no error anywhere. Naming the bad path
        and offering the near-misses turns the least debuggable failure this
        feature has into a fixable one.
      */}
      {result.diagnostics.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 font-body dark:text-amber-500">
            <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {result.diagnostics.length}{" "}
            {result.diagnostics.length === 1 ? "variable" : "variables"} came out
            empty
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {result.diagnostics.map((d, i) => (
              <li key={`${d.field}-${d.path}-${i}`} className="text-[11px] font-body">
                <span className="font-mono text-muted-foreground">
                  {`{{${d.path}}}`}
                </span>{" "}
                <span className="text-muted-foreground">in {d.field}</span>
                {d.suggestions.length > 0 && (
                  <span className="mt-0.5 block text-muted-foreground">
                    Did you mean{" "}
                    {d.suggestions.map((s, j) => (
                      <span key={s}>
                        {j > 0 && ", "}
                        <span className="font-mono">{`{{${s}}}`}</span>
                      </span>
                    ))}
                    ?
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-[11px] text-muted-foreground font-body">
          This step has nothing filled in yet.
        </p>
      ) : (
        <dl className="space-y-2">
          {entries.map(([field, value]) => (
            <div key={field}>
              <dt className="text-[11px] font-medium text-muted-foreground font-body">
                {field}
              </dt>
              {/* `whitespace-pre-wrap` because an email body is the field this
                  is most often used on, and its line breaks are the thing being
                  checked. */}
              <dd
                className={cn(
                  "mt-0.5 whitespace-pre-wrap break-words rounded border border-border",
                  "bg-muted/40 px-2 py-1.5 text-[11px] leading-snug font-body",
                )}
              >
                {format(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function format(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}
