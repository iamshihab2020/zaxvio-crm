"use client";

import type { ScheduleOverride } from "@hvac-saas/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsSection } from "@/components/dashboard/settings/settings-section";
import { IconCalendarOff, IconPlus, IconTrash } from "@tabler/icons-react";

interface AvailabilityOverrideListProps {
  overrides: ScheduleOverride[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export function AvailabilityOverrideList({
  overrides,
  onAdd,
  onDelete,
}: AvailabilityOverrideListProps) {
  return (
    <SettingsSection
      icon={IconCalendarOff}
      title="Schedule Overrides"
      description="Override specific dates for holidays, closures, or custom hours."
      action={
        <Button size="sm" variant="outline" onClick={onAdd}>
          <IconPlus className="mr-2 h-4 w-4" />
          Add Override
        </Button>
      }
    >
      {overrides.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No schedule overrides. Add one for holidays or special closures.
        </p>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead className="w-[48px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.map((override) => (
                <TableRow key={override.id}>
                  <TableCell className="text-sm font-medium">
                    {formatDate(override.overrideDate)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {override.reason || "—"}
                  </TableCell>
                  <TableCell>
                    {override.isAvailable ? (
                      <Badge className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300">
                        Open
                      </Badge>
                    ) : (
                      <Badge className="bg-muted/50 text-muted-foreground">
                        Closed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {override.isAvailable && override.startTime && override.endTime
                      ? `${formatTime(override.startTime)} - ${formatTime(override.endTime)}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onDelete(override.id)}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SettingsSection>
  );
}
