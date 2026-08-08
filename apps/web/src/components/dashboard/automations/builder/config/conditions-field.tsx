"use client";

import { IconPlus, IconX } from "@tabler/icons-react";
import {
  FILTER_OPERATORS,
  isUnaryOperator,
  namespaceOf,
  parseConditionRules,
  variablesForSubject,
  type ConditionRule,
  type FilterOperator,
} from "@hvac-saas/workflow-nodes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldWrapper, type FieldProps } from "./field-wrapper";
import { cn } from "@/lib/utils";

/**
 * The condition builder for `condition.if`.
 *
 * A **field renderer, not a bespoke panel.** wf-08 C-3 lists this node as one
 * of four allowed to have a hand-written panel, and it turned out not to need
 * one: a condition is a list, and a list is a field. Keeping it as a field
 * means the rest of the node's form is still generated from its definition, and
 * `condition.if` does not become the place where the definition stops being the
 * source of truth.
 *
 * Operators come from `FILTER_OPERATORS` — the same closed set the trigger
 * filters use — so this dropdown cannot offer a comparison the engine does not
 * implement.
 */

/** Wording, not the stored value. The ids are permanent; these are not. */
const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "is",
  notEquals: "is not",
  contains: "contains",
  notContains: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  greaterThan: "is more than",
  greaterThanOrEqual: "is at least",
  lessThan: "is less than",
  lessThanOrEqual: "is at most",
  between: "is between",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
  isTrue: "is yes",
  isFalse: "is no",
  inList: "is one of",
  notInList: "is none of",
  dateBefore: "is before",
  dateAfter: "is after",
  dateWithinNext: "is within the next (days)",
  dateWithinLast: "was within the last (days)",
  isToday: "is today",
};

/**
 * Which comparisons make sense for which kind of value.
 *
 * Offering "is more than" on an email address is not wrong so much as noise —
 * twenty-two operators on every row is a list nobody reads. Narrowing by the
 * variable's declared type is free, because the type is on the declaration.
 */
const OPERATORS_BY_TYPE: Record<string, FilterOperator[]> = {
  string: ["equals", "notEquals", "contains", "notContains", "startsWith", "endsWith", "isEmpty", "isNotEmpty", "inList", "notInList"],
  number: ["equals", "notEquals", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual", "between", "isEmpty", "isNotEmpty"],
  money: ["equals", "notEquals", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual", "between", "isEmpty", "isNotEmpty"],
  boolean: ["isTrue", "isFalse"],
  date: ["dateBefore", "dateAfter", "dateWithinNext", "dateWithinLast", "isToday", "isEmpty", "isNotEmpty"],
  datetime: ["dateBefore", "dateAfter", "dateWithinNext", "dateWithinLast", "isToday", "isEmpty", "isNotEmpty"],
  time: ["equals", "notEquals", "isEmpty", "isNotEmpty"],
  array: ["inList", "notInList", "isEmpty", "isNotEmpty"],
  object: ["isEmpty", "isNotEmpty"],
};

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
};

export function ConditionsField({
  property,
  value,
  onChange,
  disabled,
  subject,
}: FieldProps) {
  const rules = parseConditionRules(value);
  const variables = variablesForSubject(subject);

  const grouped = variables.reduce<Record<string, typeof variables>>((acc, v) => {
    const ns = namespaceOf(v.path);
    (acc[ns] ??= []).push(v);
    return acc;
  }, {});

  function update(index: number, patch: Partial<ConditionRule>) {
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  return (
    <FieldWrapper property={property} invalid={!!property.required && rules.length === 0}>
      <div className="space-y-2">
        {rules.map((rule, index) => {
          const declared = variables.find((v) => v.path === rule.variable);
          // An unknown path still lists every operator — the variable may come
          // from a trigger that changed, and hiding the operators would make
          // the row unrepairable.
          const allowed = declared
            ? (OPERATORS_BY_TYPE[declared.type] ?? [...FILTER_OPERATORS])
            : [...FILTER_OPERATORS];
          const unary = isUnaryOperator(rule.operator);

          return (
            <div
              key={index}
              className="space-y-1.5 rounded-md border border-border bg-muted/30 p-2"
            >
              <div className="flex items-start gap-1.5">
                <Select
                  value={rule.variable}
                  onValueChange={(variable) => update(index, { variable })}
                  disabled={disabled}
                >
                  <SelectTrigger className="flex-1 font-body text-left [&>span]:flex-1 [&>span]:truncate [&>span]:text-left">
                    <SelectValue placeholder="Choose something to check" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(grouped).map(([ns, list]) => (
                      <SelectGroup key={ns}>
                        <SelectLabel>{NAMESPACE_LABELS[ns] ?? ns}</SelectLabel>
                        {list.map((v) => (
                          <SelectItem key={v.path} value={v.path}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground"
                  onClick={() => onChange(rules.filter((_, i) => i !== index))}
                  disabled={disabled}
                  aria-label="Remove this check"
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex gap-1.5">
                <Select
                  value={rule.operator}
                  onValueChange={(operator) =>
                    update(index, {
                      operator: operator as FilterOperator,
                      // Switching to a presence check drops the value: leaving
                      // it would store a comparison the engine never reads,
                      // which reappears if the operator is switched back and
                      // silently changes what the rule means.
                      value: isUnaryOperator(operator as FilterOperator)
                        ? undefined
                        : rule.value,
                    })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger
                    className={cn(
                      "font-body text-left [&>span]:flex-1 [&>span]:truncate [&>span]:text-left",
                      unary ? "flex-1" : "w-[46%]",
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowed.map((op) => (
                      <SelectItem key={op} value={op}>
                        {OPERATOR_LABELS[op]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* A presence check has nothing to compare against, so the box
                    goes away rather than sitting there disabled and inviting a
                    value that would never be read. */}
                {!unary && (
                  <Input
                    value={rule.value === undefined ? "" : String(rule.value)}
                    onChange={(e) =>
                      update(index, { value: coerce(e.target.value, declared?.type) })
                    }
                    placeholder={placeholderFor(rule.operator)}
                    disabled={disabled}
                    className="flex-1 font-body"
                  />
                )}
              </div>
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-body"
          onClick={() =>
            onChange([...rules, { variable: "", operator: "equals", value: "" }])
          }
          disabled={disabled}
        >
          <IconPlus className="mr-1.5 h-3.5 w-3.5" />
          Add a check
        </Button>

        {rules.length === 0 && (
          <p className="text-[11px] text-muted-foreground font-body">
            With no checks, this step can&rsquo;t decide anything — everything
            would go down No.
          </p>
        )}
      </div>
    </FieldWrapper>
  );
}

/**
 * Keep numbers as numbers.
 *
 * `greaterThan` on the string "500" compares lexically, so "1000" is less than
 * "500". The declared type is what says which is meant — guessing from the text
 * would turn a postcode or an invoice number into a number the moment it
 * happened to be all digits.
 */
function coerce(raw: string, type: string | undefined): unknown {
  if (raw === "") return "";
  if (type === "number" || type === "money") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}

function placeholderFor(operator: FilterOperator): string {
  if (operator === "between") return "10 and 20";
  if (operator === "inList" || operator === "notInList") return "one, two, three";
  if (operator === "dateWithinNext" || operator === "dateWithinLast") return "7";
  return "Value";
}
