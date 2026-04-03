"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  IconPlus,
  IconTrash,
  IconSelector,
  IconCheck,
  IconGripVertical,
} from "@tabler/icons-react";
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/lib/constants/job-options";
import {
  CatalogItemPicker,
  type CatalogPickerItem,
} from "@/components/dashboard/catalog/catalog-item-picker";

export interface TemplateItemFormData {
  id?: string;
  label: string;
  isRequired: boolean;
  catalogItemId: string | null;
  catalogItemLabel: string;
  sortOrder: number;
}

export interface TemplateFormData {
  name: string;
  serviceType: string;
  isActive: boolean;
  items: TemplateItemFormData[];
}

interface ChecklistTemplateDialogProps {
  template?: {
    id: string;
    name: string;
    serviceType: ServiceType;
    isActive: boolean;
    items?: Array<{
      id: string;
      label: string;
      isRequired: boolean;
      catalogItemId: string | null;
      catalogItemName?: string | null;
      catalogItemPrice?: string | null;
      sortOrder: number;
    }>;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: TemplateFormData) => void;
  loading: boolean;
}

const emptyItem: TemplateItemFormData = {
  label: "",
  isRequired: true,
  catalogItemId: null,
  catalogItemLabel: "",
  sortOrder: 0,
};

export function ChecklistTemplateDialog({
  template,
  open,
  onOpenChange,
  onSave,
  loading,
}: ChecklistTemplateDialogProps) {
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState<string>("repair");
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<TemplateItemFormData[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serviceTypeOpen, setServiceTypeOpen] = useState(false);

  const isEditing = !!template;

  useEffect(() => {
    if (template) {
      setName(template.name);
      setServiceType(template.serviceType);
      setIsActive(template.isActive);
      setItems(
        template.items?.map((item) => ({
          id: item.id,
          label: item.label,
          isRequired: item.isRequired,
          catalogItemId: item.catalogItemId,
          catalogItemLabel: item.catalogItemName ?? "",
          sortOrder: item.sortOrder,
        })) ?? [],
      );
    } else {
      setName("");
      setServiceType("repair");
      setIsActive(true);
      setItems([]);
    }
    setErrors({});
  }, [template, open]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { ...emptyItem, sortOrder: prev.length },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, updates: Partial<TemplateItemFormData>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item)),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "Name is required";
    if (!serviceType) newErrors.serviceType = "Service type is required";

    // Validate items
    items.forEach((item, idx) => {
      if (!item.label.trim()) {
        newErrors[`item_${idx}`] = "Label is required";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: name.trim(),
      serviceType,
      isActive,
      items: items.map((item, idx) => ({
        ...item,
        sortOrder: idx,
      })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEditing ? "Edit Checklist Template" : "Create Checklist Template"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the checklist template and its items."
              : "Define a checklist that auto-attaches to jobs by service type."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tpl-name" className="font-body">
              Template Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
              }}
              placeholder="AC Installation Checklist"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-body">
                Service Type <span className="text-destructive">*</span>
              </Label>
              <Popover open={serviceTypeOpen} onOpenChange={setServiceTypeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full justify-between font-body"
                  >
                    {SERVICE_TYPE_LABELS[serviceType as ServiceType] ?? "Select..."}
                    <IconSelector className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-1" align="start">
                  {SERVICE_TYPES.map((st) => (
                    <Button
                      key={st}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setServiceType(st);
                        setServiceTypeOpen(false);
                      }}
                      className="w-full justify-start gap-2 font-body"
                    >
                      {serviceType === st && (
                        <IconCheck className="h-4 w-4 text-brand shrink-0" />
                      )}
                      <span className={cn(serviceType !== st && "pl-6")}>
                        {SERVICE_TYPE_LABELS[st]}
                      </span>
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>
              {errors.serviceType && (
                <p className="text-sm text-destructive">{errors.serviceType}</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                id="tpl-active"
                className="h-4 w-4 rounded border-border accent-brand cursor-pointer"
              />
              <Label htmlFor="tpl-active" className="font-body cursor-pointer">
                Active
              </Label>
            </div>
          </div>

          {/* Checklist Items */}
          <div className="space-y-2">
            <Label className="font-body">Checklist Items</Label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-border p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <IconGripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground font-medium w-5">
                      {idx + 1}
                    </span>
                    <Input
                      value={item.label}
                      onChange={(e) => {
                        updateItem(idx, { label: e.target.value });
                        if (errors[`item_${idx}`])
                          setErrors((prev) => ({ ...prev, [`item_${idx}`]: "" }));
                      }}
                      placeholder="Check refrigerant levels"
                      className="text-sm flex-1"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.isRequired}
                          onChange={(e) =>
                            updateItem(idx, { isRequired: e.target.checked })
                          }
                          className="h-3.5 w-3.5 rounded border-border accent-brand cursor-pointer"
                        />
                        Req
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(idx)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {errors[`item_${idx}`] && (
                    <p className="text-sm text-destructive pl-9">
                      {errors[`item_${idx}`]}
                    </p>
                  )}
                  <div className="pl-9">
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Linked catalog item (auto-adds to line items on completion)
                    </label>
                    <CatalogItemPicker
                      selectedId={item.catalogItemId}
                      selectedLabel={item.catalogItemLabel}
                      onSelect={(catalogItem: CatalogPickerItem | null) => {
                        if (catalogItem) {
                          updateItem(idx, {
                            catalogItemId: catalogItem.id,
                            catalogItemLabel: catalogItem.name,
                          });
                        } else {
                          updateItem(idx, {
                            catalogItemId: null,
                            catalogItemLabel: "",
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              className="cursor-pointer"
            >
              <IconPlus className="mr-1.5 h-3.5 w-3.5" />
              Add Item
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-brand text-brand-foreground hover:bg-brand/90"
              disabled={loading}
            >
              {loading
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
