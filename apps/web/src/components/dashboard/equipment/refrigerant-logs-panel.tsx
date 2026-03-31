"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconDroplet, IconPlus } from "@tabler/icons-react";
import { getEquipmentRefrigerantLogs, createRefrigerantLog } from "@/actions/equipment";
import {
  RefrigerantLogDialog,
  type RefrigerantLogFormData,
} from "./refrigerant-log-dialog";

interface RefrigerantLogsPanelProps {
  equipmentId: string;
}

interface RefrigerantLogRow {
  id: string;
  refrigerantType: string;
  action: string;
  quantity: string;
  unit: string | null;
  technicianName: string | null;
  epaCertNumber: string | null;
  notes: string | null;
  createdAt: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const actionColors: Record<string, string> = {
  added: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  recovered:
    "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  recycled:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

export function RefrigerantLogsPanel({
  equipmentId,
}: RefrigerantLogsPanelProps) {
  const [logs, setLogs] = useState<RefrigerantLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const result = await getEquipmentRefrigerantLogs(equipmentId, {
      limit: 50,
    });
    if (result.data) {
      setLogs(result.data as RefrigerantLogRow[]);
    }
    setLoading(false);
  }, [equipmentId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  async function handleSave(data: RefrigerantLogFormData) {
    setSaving(true);
    const result = await createRefrigerantLog(equipmentId, {
      refrigerantType: data.refrigerantType,
      action: data.action,
      quantity: parseFloat(data.quantity),
      unit: data.unit,
      technicianName: data.technicianName || undefined,
      epaCertNumber: data.epaCertNumber || undefined,
      notes: data.notes || undefined,
    });
    if (!result.error) {
      setDialogOpen(false);
      await fetchLogs();
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground font-heading">
          <IconDroplet className="h-4 w-4 text-brand" />
          Refrigerant Logs
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="h-7 text-xs"
        >
          <IconPlus className="h-3.5 w-3.5 mr-1" />
          Add Log
        </Button>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-8 text-center">
          <IconDroplet className="h-5 w-5 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No refrigerant logs yet
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead className="hidden md:table-cell">
                  Technician
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {formatDate(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={actionColors[log.action] ?? ""}
                    >
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.refrigerantType}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.quantity} {log.unit ?? "lbs"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {log.technicianName ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RefrigerantLogDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        loading={saving}
      />
    </div>
  );
}
