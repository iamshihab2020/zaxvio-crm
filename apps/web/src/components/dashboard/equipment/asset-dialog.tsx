"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface AssetFormData {
  equipmentType: string;
  brand: string;
  model: string;
  serialNumber: string;
  installDate: string;
  warrantyExpiry: string;
  location: string;
  notes: string;
}

interface AssetDialogProps {
  asset: AssetFormData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: AssetFormData) => void;
  loading: boolean;
}

const emptyForm: AssetFormData = {
  equipmentType: "",
  brand: "",
  model: "",
  serialNumber: "",
  installDate: "",
  warrantyExpiry: "",
  location: "",
  notes: "",
};

export function AssetDialog({
  asset,
  open,
  onOpenChange,
  onSave,
  loading,
}: AssetDialogProps) {
  const [form, setForm] = useState<AssetFormData>(emptyForm);
  const [errors, setErrors] = useState<
    Partial<Record<keyof AssetFormData, string>>
  >({});

  const isEditing = !!asset;

  useEffect(() => {
    if (asset) {
      setForm({ ...asset });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [asset, open]);

  function validateForm(): boolean {
    const newErrors: typeof errors = {};
    if (!form.equipmentType.trim()) newErrors.equipmentType = "Required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validateForm()) return;
    onSave(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEditing ? "Edit Asset" : "Add Asset"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="font-body">Asset Type *</Label>
              <Input
                value={form.equipmentType}
                onChange={(e) =>
                  setForm({ ...form, equipmentType: e.target.value })
                }
                placeholder="e.g., AC Unit, Water Heater, Generator"
              />
              {errors.equipmentType && (
                <p className="text-xs text-destructive">
                  {errors.equipmentType}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="font-body">Brand</Label>
              <Input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="e.g., Carrier, Rheem"
              />
            </div>

            <div className="space-y-1">
              <Label className="font-body">Model</Label>
              <Input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="Model number"
              />
            </div>

            <div className="space-y-1">
              <Label className="font-body">Serial Number</Label>
              <Input
                value={form.serialNumber}
                onChange={(e) =>
                  setForm({ ...form, serialNumber: e.target.value })
                }
                placeholder="Serial number"
              />
            </div>

            <div className="space-y-1">
              <Label className="font-body">Location</Label>
              <Input
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
                placeholder="e.g., Rooftop, Basement"
              />
            </div>

            <div className="space-y-1">
              <Label className="font-body">Install Date</Label>
              <Input
                type="date"
                value={form.installDate}
                onChange={(e) =>
                  setForm({ ...form, installDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-1">
              <Label className="font-body">Warranty Expiry</Label>
              <Input
                type="date"
                value={form.warrantyExpiry}
                onChange={(e) =>
                  setForm({ ...form, warrantyExpiry: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="font-body">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional notes about this asset..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-brand text-brand-foreground hover:bg-brand/90"
          >
            {loading ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
