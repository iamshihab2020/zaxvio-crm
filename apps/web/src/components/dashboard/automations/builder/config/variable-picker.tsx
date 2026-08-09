"use client";

import { useMemo, useState } from "react";
import { IconVariable } from "@tabler/icons-react";
import {
  namespaceOf,
  variablesForSubject,
  type SubjectType,
  type VariableDef,
} from "@hvac-saas/workflow-nodes";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Pick a `{{variable}}` to drop into a field.
 *
 * **Trigger-scoped, always.** A booking-triggered automation is not offered
 * `{{invoice.balanceDue}}`, because a variable the run cannot resolve produces
 * a blank space in a customer's email and nothing else — the least debuggable
 * failure this feature has. `variablesForSubject` does that filtering off the
 * declaration, so it costs nothing to be right.
 *
 * Grouped by namespace rather than listed flat: ninety paths in one column is a
 * scroll, and the namespace is the first thing anyone knows about what they are
 * looking for ("something about the customer").
 */

interface Props {
  /** What the trigger provides. `null` = unknown, so everything is offered. */
  subject: SubjectType | null;
  onInsert: (token: string) => void;
  disabled?: boolean;
  /** Positioned inside the field it belongs to, unless the field is a textarea. */
  className?: string;
}

/** Reads better than the raw namespace in a group heading. */
const NAMESPACE_LABELS: Record<string, string> = {
  customer: "Customer",
  job: "Job",
  invoice: "Invoice",
  quote: "Quote",
  booking: "Booking",
  equipment: "Equipment",
  contract: "Service agreement",
  tenant: "Your business",
  trigger: "What set this off",
  now: "Date & time",
  previous: "Earlier steps",
  vars: "Your values",
  loop: "Current item",
};

export function VariablePicker({ subject, onInsert, disabled, className }: Props) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const available = variablesForSubject(subject);
    const byNamespace = new Map<string, VariableDef[]>();
    for (const variable of available) {
      const ns = namespaceOf(variable.path);
      const list = byNamespace.get(ns);
      if (list) list.push(variable);
      else byNamespace.set(ns, [variable]);
    }
    return [...byNamespace.entries()].map(([id, variables]) => ({
      id,
      label: NAMESPACE_LABELS[id] ?? id,
      variables,
    }));
  }, [subject]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label="Insert a variable"
          title="Insert a variable"
          className={cn(
            "h-6 w-6 shrink-0 text-muted-foreground hover:text-brand",
            className,
          )}
        >
          <IconVariable className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" side="bottom" sideOffset={6} className="w-[320px] p-0">
        <Command
          // Search the path and the description as well as the label — people
          // look for "email" and the label is "Email address", but they also
          // paste half a path they saw in another automation.
          filter={(value, search) =>
            value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search variables..." className="font-body" />
          <CommandList className="max-h-72">
            <CommandEmpty className="py-6 text-center text-sm font-body">
              Nothing matches that.
            </CommandEmpty>

            {groups.map((group) => (
              <CommandGroup key={group.id} heading={group.label}>
                {group.variables.map((variable) => (
                  <CommandItem
                    key={variable.path}
                    value={`${variable.path} ${variable.label} ${variable.description}`}
                    onSelect={() => {
                      onInsert(`{{${variable.path}}}`);
                      setOpen(false);
                    }}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="flex w-full items-baseline justify-between gap-2">
                      <span className="text-sm font-medium font-body">
                        {variable.label}
                      </span>
                      {/* The path in mono, because it is an identifier the user
                          may want to recognise or type again elsewhere. */}
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {variable.path}
                      </span>
                    </span>
                    <span className="text-[11px] leading-snug text-muted-foreground font-body">
                      {variable.description}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
