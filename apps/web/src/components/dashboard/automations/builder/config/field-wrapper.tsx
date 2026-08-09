"use client";

import type { NodeProperty, SubjectType } from "@hvac-saas/workflow-nodes";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The chrome around every field: label, required marker, description, hint.
 *
 * One wrapper is what keeps a new field type at ~30 lines instead of ~80, and
 * it is the reason "add a node definition, get a form" holds — a field renderer
 * only has to render its control.
 */

export interface FieldProps<T = unknown> {
  property: NodeProperty;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Sibling values, so a stage picker can read the pipelineId next to it. */
  siblings: Record<string, unknown>;
  nodeId: string;
  /**
   * What the automation's trigger provides, so the variable picker only offers
   * paths this run can actually resolve. `null` means it could not be
   * determined — everything is offered rather than nothing, because a picker
   * that hides what you need is worse than one that shows too much.
   */
  subject: SubjectType | null;
}

interface FieldWrapperProps {
  property: NodeProperty;
  /** Rendered when the value is required and empty. */
  invalid?: boolean;
  children: React.ReactNode;
  /** `boolean` puts its control beside the label rather than under it. */
  inline?: boolean;
}

export function FieldWrapper({
  property,
  invalid,
  children,
  inline,
}: FieldWrapperProps) {
  const id = `field-${property.name}`;

  return (
    <div className={cn("space-y-1.5", inline && "flex items-start justify-between gap-4 space-y-0")}>
      <div className={cn(inline && "min-w-0 flex-1")}>
        {/* `font-body` and nothing else — the dashboard's form-label
            convention, used 59 times. The size and weight come from the shared
            `Label` primitive, so these fields match every other form in the
            app rather than sitting one step off it. */}
        <Label htmlFor={id} className="font-body">
          {property.displayName}
          {property.required && (
            // A dot, not an asterisk. An asterisk is conventionally a footnote
            // marker and sends people looking for the footnote.
            <span
              className={cn(
                "ml-1 inline-block h-1 w-1 rounded-full align-middle",
                invalid ? "bg-amber-500" : "bg-muted-foreground/50",
              )}
              aria-hidden
            />
          )}
          {property.required && <span className="sr-only">(required)</span>}
        </Label>

        {property.description && (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground font-body">
            {property.description}
          </p>
        )}
      </div>

      <div className={cn(inline && "shrink-0 pt-0.5")}>{children}</div>

      {/* The hint sits BELOW the control — it is about how to fill it in, and
          above the control it would be read as part of the description. */}
      {property.hint && !inline && (
        <p className="text-[11px] leading-snug text-muted-foreground/80 font-body">
          {property.hint}
        </p>
      )}
    </div>
  );
}
