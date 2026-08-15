"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  IconPlus,
  IconDots,
  IconEdit,
  IconTrash,
  IconClock,
  IconAlertTriangle,
  IconReceipt,
} from "@tabler/icons-react";
import type { JobCostSummary, JobExpense } from "@hvac-saas/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/lib/constants/costing-options";
import {
  useJobCosts,
  useJobExpenses,
  useAddJobExpense,
  useUpdateJobExpense,
  useDeleteJobExpense,
} from "@/hooks/queries";
import { JobCostStack } from "./job-cost-stack";

interface JobDetailCostsProps {
  jobId: string;
  /** Switch to the Time tab. Optional — a caller with no tab strip omits it. */
  onOpenTime?: () => void;
}

interface ExpenseForm {
  category: ExpenseCategory;
  description: string;
  amount: string;
  incurredOn: string;
  vendor: string;
}

function emptyExpense(): ExpenseForm {
  return {
    category: "material",
    description: "",
    amount: "",
    incurredOn: new Date().toISOString().slice(0, 10),
    vendor: "",
  };
}

export function JobDetailCosts({ jobId, onOpenTime }: JobDetailCostsProps) {
  const costs = useJobCosts(jobId);
  const expenses = useJobExpenses(jobId);

  const summary = costs.data?.data ?? null;
  const rows = expenses.data?.data ?? [];
  const errorMessage = costs.data?.error ?? expenses.data?.error ?? null;

  if (costs.isLoading || expenses.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!summary) {
    return (
      <LoadErrorState
        title="Couldn't load costs"
        message={errorMessage ?? "The cost summary is unavailable right now."}
        onRetry={() => void costs.refetch()}
        isRetrying={costs.isFetching}
      />
    );
  }

  return (
    <div className="space-y-6">
      <MarginHeadline summary={summary} />
      <LaborPanel summary={summary} onOpenTime={onOpenTime} />
      <ExpensesPanel jobId={jobId} expenses={rows} />
    </div>
  );
}

// ── Margin headline ──────────────────────────────────────────

function MarginHeadline({ summary }: { summary: JobCostSummary }) {
  const complete = summary.coverage.complete;
  const margin = Number(summary.margin);
  const pct = summary.marginPct;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-body text-xs text-muted-foreground">
            {complete ? "Margin on this job" : "Margin so far"}
          </p>
          <p
            className={cn(
              "tnum font-heading text-2xl font-bold",
              !complete
                ? "text-muted-foreground"
                : margin < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-foreground",
            )}
          >
            {formatMoney(summary.margin)}
            {pct !== null && (
              <span className="ml-2 font-body text-sm font-medium text-muted-foreground">
                {Math.round(pct * 100)}%
              </span>
            )}
          </p>
        </div>
        <p className="font-body text-xs text-muted-foreground">
          {summary.revenueBasis === "invoiced"
            ? "Against what you invoiced"
            : "Against the job total — no invoice yet"}
        </p>
      </div>

      <JobCostStack summary={summary} />

      {!complete && (
        <div className="mt-3 flex gap-2 rounded-md border border-border bg-muted/40 p-3">
          <IconAlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-body text-xs font-medium text-foreground">
              This margin is provisional
            </p>
            <ul className="mt-1 space-y-0.5">
              {summary.coverage.gaps.map((gap) => (
                <li
                  key={gap}
                  className="font-body text-xs leading-snug text-muted-foreground"
                >
                  {gap}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Labour ───────────────────────────────────────────────────

/**
 * Read-only. Hours used to be a text box here, typed from memory days later and
 * multiplied by one rate resolved from the assignee — so it was usually empty,
 * and a two-person job could not be expressed at all. They are now the sum of
 * the job's time entries, and the only way to change the number is to change the
 * work it came from, which is the Time tab's job.
 */
function LaborPanel({
  summary,
  onOpenTime,
}: {
  summary: JobCostSummary;
  onOpenTime?: () => void;
}) {
  const { actualHours, timeEntryCount, coverage } = summary;

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <IconClock className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="font-heading text-sm font-semibold text-foreground">
          Time on site
        </h3>
      </div>

      <div className="rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {actualHours ? (
              <>
                <p className="tnum font-mono text-lg font-semibold text-foreground">
                  {actualHours} h
                </p>
                <p className="font-body text-xs text-muted-foreground">
                  across {timeEntryCount}{" "}
                  {timeEntryCount === 1 ? "entry" : "entries"}
                  {coverage.laborCosted && (
                    <>
                      {" · costing "}
                      <span className="tnum font-mono font-medium text-foreground">
                        {formatMoney(summary.laborCost)}
                      </span>
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="font-body text-sm text-foreground">
                  No time recorded
                </p>
                <p className="font-body text-xs text-muted-foreground">
                  Labour is usually the largest cost on a job. Until somebody
                  logs time, this margin is missing its biggest input.
                </p>
              </>
            )}
          </div>

          {onOpenTime && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenTime}
              className="cursor-pointer"
            >
              {actualHours ? "View time" : "Log time"}
            </Button>
          )}
        </div>

        {/* Each entry carries its own snapshotted rate, so there is no single
            "cost rate" to print here any more — one job can legitimately hold
            several. The per-entry rate lives on the Time tab, where the person
            it belongs to is named beside it. */}
        {coverage.timeEntries > 0 && !coverage.laborCosted && (
          <p className="mt-2 font-body text-xs text-muted-foreground">
            Some of this time has no cost rate, so labour here is understated.
            Set a rate in Settings → Business, or per person under Team.
          </p>
        )}
      </div>
    </section>
  );
}

// ── Expenses ─────────────────────────────────────────────────

function ExpensesPanel({
  jobId,
  expenses,
}: {
  jobId: string;
  expenses: JobExpense[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(emptyExpense);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const add = useAddJobExpense(jobId);
  const update = useUpdateJobExpense(jobId);
  const remove = useDeleteJobExpense(jobId);

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  function validate(f: ExpenseForm): string | null {
    if (!f.description.trim()) return "Describe what this cost was for";
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(f.amount.trim()))
      return "Enter an amount, like 84.50";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.incurredOn)) return "Pick a date";
    return null;
  }

  function payload(f: ExpenseForm) {
    return {
      category: f.category,
      description: f.description.trim(),
      amount: f.amount.trim(),
      incurredOn: f.incurredOn,
      ...(f.vendor.trim() ? { vendor: f.vendor.trim() } : {}),
    };
  }

  function handleSubmit() {
    const problem = validate(form);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (editingId) {
      update.mutate(
        { expenseId: editingId, data: payload(form) },
        {
          onSuccess: (res) => {
            if (!res.error) {
              setEditingId(null);
              setForm(emptyExpense());
              setShowAdd(false);
            }
          },
        },
      );
      return;
    }
    add.mutate(payload(form), {
      onSuccess: (res) => {
        if (!res.error) {
          setForm(emptyExpense());
          setShowAdd(false);
        }
      },
    });
  }

  function startEdit(expense: JobExpense) {
    setEditingId(expense.id);
    setForm({
      category: expense.category as ExpenseCategory,
      description: expense.description,
      amount: expense.amount,
      incurredOn: expense.incurredOn,
      vendor: expense.vendor ?? "",
    });
    setShowAdd(true);
  }

  function cancel() {
    setShowAdd(false);
    setEditingId(null);
    setForm(emptyExpense());
  }

  const saving = add.isPending || update.isPending;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconReceipt className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Expenses
          </h3>
        </div>
        {!showAdd && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdd(true)}
            className="cursor-pointer"
          >
            <IconPlus className="mr-1.5 h-3.5 w-3.5" />
            Add expense
          </Button>
        )}
      </div>

      {expenses.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <p className="font-body text-sm text-foreground">
            No expenses on this job
          </p>
          <p className="mt-1 max-w-sm font-body text-xs text-muted-foreground">
            Add the costs no line item covers — a parts run, a subcontractor,
            a permit fee — and they come off the margin above.
          </p>
        </div>
      )}

      {expenses.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left font-body font-medium text-muted-foreground">
                  What
                </th>
                <th className="w-24 px-3 py-2 text-left font-body font-medium text-muted-foreground">
                  Date
                </th>
                <th className="w-24 px-3 py-2 text-right font-body font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-2">
                    <div className="font-body text-foreground">
                      {expense.description}
                    </div>
                    <div className="font-body text-xs text-muted-foreground">
                      {EXPENSE_CATEGORY_LABELS[
                        expense.category as ExpenseCategory
                      ] ?? expense.category}
                      {expense.vendor ? ` · ${expense.vendor}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-body text-xs text-muted-foreground">
                    {formatDateOnly(expense.incurredOn)}
                  </td>
                  <td className="tnum px-3 py-2 text-right font-mono font-medium text-foreground">
                    {formatMoney(expense.amount)}
                  </td>
                  <td className="px-2 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={`Actions for ${expense.description}`}
                        >
                          <IconDots className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => startEdit(expense)}
                          className="cursor-pointer"
                        >
                          <IconEdit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setConfirmingId(expense.id)}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <IconTrash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between border-t border-border bg-muted/30 px-3 py-2">
            <span className="font-body text-sm font-medium text-muted-foreground">
              Total expenses
            </span>
            <span className="tnum font-mono text-sm font-semibold text-foreground">
              {formatMoney(total)}
            </span>
          </div>
        </div>
      )}

      {confirmingId && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="font-body text-sm text-foreground">
            Delete this expense? The margin above will go back up.
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingId(null)}
              className="cursor-pointer"
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(confirmingId, {
                  onSuccess: () => setConfirmingId(null),
                })
              }
              className="cursor-pointer"
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="mt-3 space-y-2 rounded-md border border-border p-3">
          <Input
            placeholder="What was this cost for?"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            className="text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Select
              value={form.category}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, category: v as ExpenseCategory }))
              }
            >
              <SelectTrigger className="h-9 flex-1 font-body text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((value) => (
                  <SelectItem
                    key={value}
                    value={value}
                    className="font-body text-sm"
                  >
                    {EXPENSE_CATEGORY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={form.incurredOn}
              onChange={(e) =>
                setForm((f) => ({ ...f, incurredOn: e.target.value }))
              }
              className="w-40 text-sm"
              aria-label="Date the cost was incurred"
            />
            <Input
              placeholder="Amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              className="tnum w-28 text-sm"
              aria-label="Amount"
            />
          </div>
          <Input
            placeholder="Supplier — optional"
            value={form.vendor}
            onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
            className="text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cancel}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={saving}
              className="cursor-pointer bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Add expense"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
