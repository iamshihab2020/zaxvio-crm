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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface RefrigerantLogFormData {
  refrigerantType: string;
  action: string;
  quantity: string;
  unit: string;
  technicianName: string;
  epaCertNumber: string;
  notes: string;
}

interface RefrigerantLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: RefrigerantLogFormData) => void;
  loading: boolean;
}

const emptyForm: RefrigerantLogFormData = {
  refrigerantType: "",
  action: "",
  quantity: "",
  unit: "lbs",
  technicianName: "",
  epaCertNumber: "",
  notes: "",
};

const commonRefrigerants = [
  "R-410A",
  "R-22",
  "R-32",
  "R-134a",
  "R-407C",
  "R-404A",
  "R-290",
  "R-600a",
];

export function RefrigerantLogDialog({
  open,
  onOpenChange,
  onSave,
  loading,
}: RefrigerantLogDialogProps) {
  const [form, setForm] = useState<RefrigerantLogFormData>(emptyForm);
  const [errors, setErrors] = useState<
    Partial<Record<keyof RefrigerantLogFormData, string>>
  >({});

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setErrors({});
    }
  }, [open]);

  function validateForm(): boolean {
    const newErrors: typeof errors = {};
    if (!form.refrigerantType.trim())
      newErrors.refrigerantType = "Required";
    if (!form.action) newErrors.action = "Required";
    if (!form.quantity.trim()) {
      newErrors.quantity = "Required";
    } else if (isNaN(parseFloat(form.quantity)) || parseFloat(form.quantity) <= 0) {
      newErrors.quantity = "Must be a positive number";
    }
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
            Add Refrigerant Log
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="font-body">Refrigerant Type *</Label>
              <Input
                value={form.refrigerantType}
                onChange={(e) =>
                  setForm({ ...form, refrigerantType: e.target.value })
                }
                placeholder="e.g., R-410A"
                list="refrigerant-types"
              />
              <datalist id="refrigerant-types">
                {commonRefrigerants.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
              {errors.refrigerantType && (
                <p className="text-xs text-destructive">
                  {errors.refrigerantType}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="font-body">Action *</Label>
              <Select
                value={form.action}
                onValueChange={(val) => setForm({ ...form, action: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="added">Added</SelectItem>
                  <SelectItem value="recovered">Recovered</SelectItem>
                  <SelectItem value="recycled">Recycled</SelectItem>
                </SelectContent>
              </Select>
              {errors.action && (
                <p className="text-xs text-destructive">{errors.action}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="font-body">Quantity *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.quantity}
                onChange={(e) =>
                  setForm({ ...form, quantity: e.target.value })
                }
                placeholder="0.00"
              />
              {errors.quantity && (
                <p className="text-xs text-destructive">{errors.quantity}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="font-body">Unit</Label>
              <Select
                value={form.unit}
                onValueChange={(val) => setForm({ ...form, unit: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lbs">lbs</SelectItem>
                  <SelectItem value="oz">oz</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="font-body">Technician Name</Label>
              <Input
                value={form.technicianName}
                onChange={(e) =>
                  setForm({ ...form, technicianName: e.target.value })
                }
                placeholder="Tech name"
              />
            </div>

            <div className="space-y-1">
              <Label className="font-body">EPA Cert #</Label>
              <Input
                value={form.epaCertNumber}
                onChange={(e) =>
                  setForm({ ...form, epaCertNumber: e.target.value })
                }
                placeholder="EPA certification"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="font-body">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
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
            {loading ? "Saving..." : "Add Log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
