"use client";

import { getDefinition, isBlank, variablesForSubject } from "@hvac-saas/workflow-nodes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldWrapper, type FieldProps } from "./field-wrapper";
import { useBuilderStore } from "@/lib/workflow/store";
import { resolveNodeIcon } from "@/lib/workflow/icon-map";
import { cn } from "@/lib/utils";

/**
 * The two field types whose options come from **the graph or the trigger**
 * rather than from the server.
 *
 * `variablePath` offers what this automation's trigger can provide;
 * `nodeSelect` offers the other steps on this canvas. Neither has an endpoint
 * behind it, which is why they are not in `crm-pickers.tsx` — that file's whole
 * organising idea is preloaded-versus-searched, and these are neither.
 */

const TRIGGER_CLASS =
  "font-body text-left [&>span]:flex-1 [&>span]:text-left [&>span]:truncate";

/**
 * Names a variable, rather than holding a value.
 *
 * Stores a **bare path** with no braces, so interpolation leaves it alone and
 * the executor resolves the raw value. That distinction is the whole reason this
 * is a picker and not a text box with `{{}}` in it: interpolation renders
 * variables *for people*, so `{{invoice.total}}` comes back as "$1,250.00", and
 * a Switch routing on that would need a route configured as the display string.
 *
 * Scoped to what the trigger provides, via the same `variablesForSubject` the
 * validator uses — so the control cannot offer a path that would then fail
 * `unknown_variable` at publish.
 */
export function VariablePathField({
  property,
  value,
  onChange,
  disabled,
  subject,
}: FieldProps) {
  const allowed = property.typeOptions?.variableTypes;
  const options = variablesForSubject(subject).filter(
    (variable) => !allowed || (allowed as readonly string[]).includes(variable.type),
  );

  const invalid = !!property.required && isBlank(value);
  const current = typeof value === "string" ? value : "";

  // Nothing of the right kind. Said with the cause, because the fix is upstream
  // — change the trigger — and an empty dropdown reads as a broken dropdown.
  if (options.length === 0) {
    return (
      <FieldWrapper property={property} invalid={invalid}>
        <div className="rounded-md border border-dashed border-border px-3 py-2.5">
          <p className="text-[11px] leading-snug text-muted-foreground font-body">
            {allowed?.includes("array")
              ? "This trigger doesn’t carry any lists, so there is nothing to repeat over."
              : "This trigger doesn’t carry any values this step can use."}
          </p>
        </div>
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Select value={current} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={`field-${property.name}`}
          className={cn(TRIGGER_CLASS, invalid && "border-amber-500/50")}
        >
          <SelectValue placeholder={property.placeholder ?? "Choose a value"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((variable) => (
            <SelectItem key={variable.path} value={variable.path}>
              <span className="font-body">{variable.label}</span>
              <span className="ml-2 text-xs text-muted-foreground font-body">
                {variable.type}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

/**
 * Names another step on this canvas — a Jump's target.
 *
 * The only picker whose options come from the **editor's own state**. That is
 * why it reads the store directly instead of taking a prop: threading the node
 * list down through the panel and the renderer for one field would put graph
 * state into the signature of every other field too.
 *
 * The current node is excluded, because a Jump to itself never moves on — the
 * executor refuses it, and a control that can only produce a refusal should not
 * offer the option.
 */
export function NodeSelectField({
  property,
  value,
  onChange,
  disabled,
  nodeId,
}: FieldProps) {
  const nodes = useBuilderStore((state) => state.nodes);
  const invalid = !!property.required && isBlank(value);
  const current = typeof value === "string" ? value : "";

  const options = nodes.filter((node) => node.id !== nodeId);

  if (options.length === 0) {
    return (
      <FieldWrapper property={property} invalid={invalid}>
        <div className="rounded-md border border-dashed border-border px-3 py-2.5">
          <p className="text-[11px] leading-snug text-muted-foreground font-body">
            There are no other steps to jump to yet. Add one first.
          </p>
        </div>
      </FieldWrapper>
    );
  }

  // A saved target that has since been deleted. Named rather than left blank —
  // a blank trigger reads as "not set up", and the author would fix it by
  // picking something new without ever knowing a step had gone.
  const targetMissing = current && !options.some((node) => node.id === current);

  return (
    <FieldWrapper property={property} invalid={invalid || !!targetMissing}>
      <Select value={current} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={`field-${property.name}`}
          className={cn(
            TRIGGER_CLASS,
            (invalid || targetMissing) && "border-amber-500/50",
          )}
        >
          <SelectValue placeholder="Choose a step" />
        </SelectTrigger>
        <SelectContent>
          {options.map((node) => {
            // `resolveNodeIcon` takes an icon *name*, not a node type — the
            // definition is what carries the name. It falls back rather than
            // throwing, so an unknown type renders a question mark.
            const Icon = resolveNodeIcon(
              getDefinition(node.nodeType)?.icon ?? "",
            );
            return (
              <SelectItem key={node.id} value={node.id}>
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                  <span className="font-body">
                    {node.nodeConfig.label || node.nodeType}
                  </span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {targetMissing && (
        <p className="text-[11px] text-amber-600 font-body dark:text-amber-500">
          The step this pointed at has been deleted. Pick another.
        </p>
      )}
    </FieldWrapper>
  );
}
