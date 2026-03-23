"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconDots,
  IconEdit,
  IconTrash,
  IconToggleLeft,
  IconToggleRight,
  IconChecklist,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
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
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground font-body">
              Name
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground font-body">
              Service Type
            </th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground font-body w-20">
              Items
            </th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground font-body w-20">
              Status
            </th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr
              key={t.id}
              className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors"
            >
              <td className="px-4 py-3 font-body">
                <div className="flex items-center gap-2">
                  <IconChecklist className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">{t.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 font-body">
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {SERVICE_TYPE_LABELS[t.serviceType] ?? t.serviceType}
                </span>
              </td>
              <td className="px-4 py-3 text-center text-muted-foreground font-body">
                {t.itemCount}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    t.isActive
                      ? "bg-green-50 text-green-700"
                      : "bg-muted/30 text-muted-foreground",
                  )}
                >
                  {t.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-2 py-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 rounded hover:bg-muted cursor-pointer">
                      <IconDots className="h-4 w-4 text-muted-foreground" />
                    </button>
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChecklistTemplateSkeleton() {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <Skeleton className="h-4 w-full max-w-[300px]" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border last:border-0 px-4 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-8 ml-auto" />
        </div>
      ))}
    </div>
  );
}
