"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { IconChevronDown, IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  CATALOG_UNITS,
  CATALOG_CATEGORIES,
} from "@/lib/constants/catalog-options";
import type { CatalogItem } from "@hvac-saas/types";

interface CatalogItemDialogProps {
  item: CatalogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CatalogItemFormData) => void;
  loading: boolean;
  categories: string[];
}

export interface CatalogItemFormData {
  name: string;
  itemType: string;
  unitPrice: number;
  unit: string;
  category: string;
  description: string;
}

const emptyForm: CatalogItemFormData = {
  name: "",
  itemType: "labor",
  unitPrice: 0,
  unit: "each",
  category: "",
  description: "",
};

const itemTypeOptions = [
  { value: "labor", label: "Labor" },
  { value: "part", label: "Part" },
  { value: "material", label: "Material" },
  { value: "service_call", label: "Service Call" },
  { value: "other", label: "Other" },
];

export function CatalogItemDialog({
  item,
  open,
  onOpenChange,
  onSave,
  loading,
  categories,
}: CatalogItemDialogProps) {
  const [form, setForm] = useState<CatalogItemFormData>(emptyForm);
  const [errors, setErrors] = useState<
    Partial<Record<keyof CatalogItemFormData, string>>
  >({});
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const isEditing = !!item;

  // Merge static HVAC categories with dynamic ones from existing items (deduped, sorted)
  const mergedCategories = useMemo(() => {
    const set = new Set<string>([...CATALOG_CATEGORIES, ...categories]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [categories]);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        itemType: item.itemType,
        unitPrice: Number(item.unitPrice),
        unit: item.unit ?? "each",
        category: item.category ?? "",
        description: item.description ?? "",
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [item, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Partial<Record<keyof CatalogItemFormData, string>> = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (!form.itemType) newErrors.itemType = "Item type is required";
    if (isNaN(form.unitPrice) || form.unitPrice < 0)
      newErrors.unitPrice = "Must be a non-negative number";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(form);
  }

  function updateField(field: keyof CatalogItemFormData, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  const selectedTypeLabel =
    itemTypeOptions.find((o) => o.value === form.itemType)?.label ?? "Select type";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEditing ? "Edit Catalog Item" : "Add Catalog Item"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details of this catalog item."
              : "Add a new service, part, or material to your catalog."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="font-body">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g., AC Diagnostic, Capacitor 45/5"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Row 2: Item Type + Unit Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-body">
                Item Type <span className="text-destructive">*</span>
              </Label>
              <Popover open={typePopoverOpen} onOpenChange={setTypePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full justify-between"
                  >
                    {selectedTypeLabel}
                    <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-1" align="start">
                  {itemTypeOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        updateField("itemType", option.value);
                        setTypePopoverOpen(false);
                      }}
                      className={cn(
                        "w-full justify-start",
                        form.itemType === option.value && "bg-muted font-medium",
                      )}
                    >
                      {option.label}
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>
              {errors.itemType && (
                <p className="text-sm text-destructive">{errors.itemType}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitPrice" className="font-body">
                Unit Price <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unitPrice}
                  onChange={(e) =>
                    updateField("unitPrice", parseFloat(e.target.value) || 0)
                  }
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
              {errors.unitPrice && (
                <p className="text-sm text-destructive">{errors.unitPrice}</p>
              )}
            </div>
          </div>

          {/* Row 3: Unit + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-body">Unit</Label>
              <Popover open={unitOpen} onOpenChange={setUnitOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={unitOpen}
                    className={cn(
                      "h-10 w-full justify-between",
                      !form.unit && "text-muted-foreground",
                    )}
                  >
                    <span className="truncate">{form.unit || "Select unit"}</span>
                    <IconChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search units..." />
                    <CommandList>
                      <CommandEmpty>No unit found.</CommandEmpty>
                      <CommandGroup>
                        {CATALOG_UNITS.map((unit) => (
                          <CommandItem
                            key={unit}
                            value={unit}
                            onSelect={(val) => {
                              updateField("unit", val);
                              setUnitOpen(false);
                            }}
                          >
                            <IconCheck
                              className={cn(
                                "mr-2 h-3.5 w-3.5",
                                form.unit === unit ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {unit}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Category</Label>
              <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryOpen}
                    className={cn(
                      "h-10 w-full justify-between",
                      !form.category && "text-muted-foreground",
                    )}
                  >
                    <span className="truncate">{form.category || "Select category"}</span>
                    <IconChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search categories..." />
                    <CommandList>
                      <CommandEmpty>No category found.</CommandEmpty>
                      <CommandGroup>
                        {mergedCategories.map((cat) => (
                          <CommandItem
                            key={cat}
                            value={cat}
                            onSelect={(val) => {
                              updateField("category", val);
                              setCategoryOpen(false);
                            }}
                          >
                            <IconCheck
                              className={cn(
                                "mr-2 h-3.5 w-3.5",
                                form.category === cat ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {cat}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Row 4: Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="font-body">
              Description
            </Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Optional description of this item..."
              rows={3}
            />
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
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
