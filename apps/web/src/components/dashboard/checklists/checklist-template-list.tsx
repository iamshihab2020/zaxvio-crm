"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconDots,
  IconEdit,
  IconTrash,
  IconToggleLeft,
  IconToggleRight,
  IconChecklist,
} from "@tabler/icons-react";
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/lib/constants/job-options";

export interface ChecklistTemplate {
  id: string;
  name: string;
  serviceType: ServiceType;
  isActive: boolean;
  itemCount: number;
  createdAt: string;
}

interface ChecklistTemplateListProps {
  templates: ChecklistTemplate[];
  loading: boolean;
  onEdit: (template: ChecklistTemplate) => void;
  onDelete: (template: ChecklistTemplate) => void;
  onToggleActive: (template: ChecklistTemplate) => void;
}

export function ChecklistTemplateList({
  templates,
  loading,
  onEdit,
  onDelete,
  onToggleActive,
}: ChecklistTemplateListProps) {
  if (loading) {
    return <ChecklistTemplateSkeleton />;
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-body">Name</TableHead>
          <TableHead className="font-body">Service Type</TableHead>
          <TableHead className="font-body text-center w-20">Items</TableHead>
          <TableHead className="font-body text-center w-20">Status</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="font-body">
              <div className="flex items-center gap-2">
                <IconChecklist className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-foreground">{t.name}</span>
              </div>
            </TableCell>
            <TableCell className="font-body">
              <Badge variant="secondary">
                {SERVICE_TYPE_LABELS[t.serviceType] ?? t.serviceType}
              </Badge>
            </TableCell>
            <TableCell className="text-center text-muted-foreground font-body">
              {t.itemCount}
            </TableCell>
            <TableCell className="text-center">
              <Badge
                variant="secondary"
                className={
                  t.isActive
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : ""
                }
              >
                {t.isActive ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <IconDots className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => onEdit(t)}
                    className="cursor-pointer"
                  >
                    <IconEdit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onToggleActive(t)}
                    className="cursor-pointer"
                  >
                    {t.isActive ? (
                      <>
                        <IconToggleLeft className="mr-2 h-4 w-4" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <IconToggleRight className="mr-2 h-4 w-4" />
                        Activate
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(t)}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <IconTrash className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ChecklistTemplateSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-8 ml-auto" />
        </div>
      ))}
    </div>
  );
}
