"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  IconPlus,
  IconDots,
  IconEdit,
  IconTrash,
  IconAlertTriangle,
  IconClock,
} from "@tabler/icons-react";
import type { JobTimeEntryView } from "@hvac-saas/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/reusable/empty-state";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { formatMoney } from "@/lib/format";
import {
  useJobTimeEntries,
  useAddJobTimeEntry,
  useUpdateJobTimeEntry,
  useDeleteJobTimeEntry,
} from "@/hooks/queries";
import { JobTimerButton } from "./job-timer-button";

interface JobDetailTimeProps {
  jobId: string;
}

interface EntryForm {
  date: string;
  start: string;
  end: string;
  note: string;
}

function emptyEntry(): EntryForm {
  const now = new Date();
  return {
    date: toLocalDateInput(now),
    start: "",
    end: "",
    note: "",
  };
}

/** `YYYY-MM-DD` in the *browser's* zone — never `toISOString().slice(0,10)`. */
function toLocalDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * A local date + time-of-day, as the instant the user meant.
 *
 * `new Date("2026-08-15T09:00")` — no zone suffix — is parsed as **local** time,
 * which is what someone typing "9am" means. Appending a `Z` would silently
 * reinterpret it as UTC and shift every entry by the offset, which is the exact
 * class of bug that has bitten this project's date handling repeatedly.
 */
function toInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}`);
}

/** The `HH:mm` a time input wants, in the reader's own zone. */
function toTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRange(entry: JobTimeEntryView): string {
  const start = new Date(entry.startedAt);
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  if (!entry.endedAt) {
    return `${start.toLocaleTimeString(undefined, opts)} — running`;
  }
  const end = new Date(entry.endedAt);
  return `${start.toLocaleTimeString(undefined, opts)} – ${end.toLocaleTimeString(undefined, opts)}`;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function JobDetailTime({ jobId }: JobDetailTimeProps) {
  const query = useJobTimeEntries(jobId);
  const entries = query.data?.data ?? [];
  const errorMessage = query.data?.error ?? null;

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<EntryForm>(emptyEntry);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const add = useAddJobTimeEntry(jobId);
  const update = useUpdateJobTimeEntry(jobId);
  const remove = useDeleteJobTimeEntry(jobId);

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // An error and an empty list look identical once rendered as rows, and "no
  // time recorded" is a statement somebody will act on. So a failed fetch says
  // so — the finding that produced `LoadErrorState` in the first place.
  if (errorMessage) {
    return (
      <LoadErrorState
        title="Couldn't load time entries"
        message={errorMessage}
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  }

  const closed = entries.filter((e) => e.endedAt);
  const totalHours = closed.reduce((sum, e) => sum + Number(e.hours ?? 0), 0);
  // `cost` is absent entirely for members — payroll data is withheld rather than
  // zeroed, so `undefined` here means "not yours to see", not "free".
  const showsMoney = closed.some((e) => e.cost !== undefined);
  const totalCost = closed.reduce((sum, e) => sum + Number(e.cost ?? 0), 0);

  function validate(f: EntryForm): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return "Pick a date";
    if (!f.start) return "Enter a start time";
    if (!f.end) return "Enter an end time";
    const start = toInstant(f.date, f.start);
    const end = toInstant(f.date, f.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "That start or end time isn't valid";
    }
    // A shift that crosses midnight ends "before" it started on the same
    // calendar day. Telling the user to split it is honest — the alternative is
    // guessing they meant the next day, which silently doubles an entry the one
    // time the guess is wrong.
    if (end <= start) {
      return "The end time must be after the start. For a shift past midnight, log it as two entries.";
    }
    return null;
  }

  function handleSubmit() {
    const problem = validate(form);
    if (problem) {
      toast.error(problem);
      return;
    }
    const payload = {
      startedAt: toInstant(form.date, form.start).toISOString(),
      endedAt: toInstant(form.date, form.end).toISOString(),
      note: form.note.trim() || undefined,
    };

    if (editingId) {
      update.mutate(
        { entryId: editingId, data: payload },
        {
          onSuccess: (res) => {
            if (!res.error) {
              setEditingId(null);
              setShowAdd(false);
              setForm(emptyEntry());
            }
          },
        },
      );
      return;
    }

    add.mutate(payload, {
      onSuccess: (res) => {
        if (!res.error) {
          setShowAdd(false);
          setForm(emptyEntry());
        }
      },
    });
  }

  function beginEdit(entry: JobTimeEntryView) {
    if (!entry.endedAt) {
      toast.error("Stop the timer before editing this entry");
      return;
    }
    setEditingId(entry.id);
    setForm({
      date: toLocalDateInput(new Date(entry.startedAt)),
      start: toTimeInput(entry.startedAt),
      end: toTimeInput(entry.endedAt),
      note: entry.note ?? "",
    });
    setShowAdd(true);
  }

  function cancelForm() {
    setShowAdd(false);
    setEditingId(null);
    setForm(emptyEntry());
  }

  const pending = add.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="tnum font-mono text-lg font-semibold text-foreground">
            {totalHours.toFixed(2)} h
          </p>
          <p className="font-body text-xs text-muted-foreground">
            {closed.length} {closed.length === 1 ? "entry" : "entries"}
            {showsMoney && ` · ${formatMoney(totalCost.toFixed(2))} of labour`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <JobTimerButton jobId={jobId} size="sm" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => (showAdd ? cancelForm() : setShowAdd(true))}
            className="cursor-pointer"
          >
            <IconPlus className="mr-1 h-4 w-4" aria-hidden />
            Log time
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label
                htmlFor={`t-date-${jobId}`}
                className="mb-1 block font-body text-xs text-muted-foreground"
              >
                Date
              </Label>
              <Input
                id={`t-date-${jobId}`}
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label
                htmlFor={`t-start-${jobId}`}
                className="mb-1 block font-body text-xs text-muted-foreground"
              >
                Start
              </Label>
              <Input
                id={`t-start-${jobId}`}
                type="time"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label
                htmlFor={`t-end-${jobId}`}
                className="mb-1 block font-body text-xs text-muted-foreground"
              >
                End
              </Label>
              <Input
                id={`t-end-${jobId}`}
                type="time"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div>
            <Label
              htmlFor={`t-note-${jobId}`}
              className="mb-1 block font-body text-xs text-muted-foreground"
            >
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`t-note-${jobId}`}
              value={form.note}
              placeholder="What was this time spent on?"
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelForm}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={pending}
              className="cursor-pointer bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {pending ? "Saving…" : editingId ? "Save changes" : "Add entry"}
            </Button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={IconClock}
          title="No time recorded"
          description="Start the timer when you get to site, or log the hours afterwards. Labour is usually the largest cost on a job, so this is what makes its margin real."
          actionLabel="Log time"
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm font-medium text-foreground">
                    {entry.userName ?? "Unknown"}
                  </span>
                  {!entry.endedAt && (
                    <Badge
                      variant="outline"
                      className="border-brand/40 text-brand"
                    >
                      Running
                    </Badge>
                  )}
                  {entry.autoStopped && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-500"
                    >
                      <IconAlertTriangle className="h-3 w-3" aria-hidden />
                      Auto-stopped
                    </Badge>
                  )}
                </div>
                <p className="font-body text-xs text-muted-foreground">
                  {formatDay(entry.startedAt)} · {formatRange(entry)}
                </p>
                {entry.note && (
                  <p className="mt-1 font-body text-xs text-foreground">
                    {entry.note}
                  </p>
                )}
                {entry.autoStopped && (
                  <p className="mt-1 font-body text-[11px] leading-tight text-muted-foreground">
                    This timer ran past 12 hours and was closed automatically.
                    Edit it to correct the end time.
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="text-right">
                  <p className="tnum font-mono text-sm text-foreground">
                    {entry.hours ? `${entry.hours} h` : "—"}
                  </p>
                  {/* Absent for members, and `null` when nobody has set a rate
                      for this person. The two are different problems and only
                      one of them is the reader's to fix. */}
                  {entry.cost !== undefined && (
                    <p className="tnum font-mono text-xs text-muted-foreground">
                      {entry.cost === null ? "no rate" : formatMoney(entry.cost)}
                    </p>
                  )}
                </div>

                {confirmingId === entry.id ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 cursor-pointer px-2 text-xs"
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate(entry.id, {
                          onSuccess: (res) => {
                            if (!res.error) setConfirmingId(null);
                          },
                        })
                      }
                    >
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 cursor-pointer px-2 text-xs"
                      onClick={() => setConfirmingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 cursor-pointer"
                        aria-label="Time entry actions"
                      >
                        <IconDots className="h-4 w-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => beginEdit(entry)}
                      >
                        <IconEdit className="mr-2 h-4 w-4" aria-hidden />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => setConfirmingId(entry.id)}
                      >
                        <IconTrash className="mr-2 h-4 w-4" aria-hidden />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
