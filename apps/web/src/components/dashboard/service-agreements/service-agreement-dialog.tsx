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
import {
  CustomerPicker,
  type CustomerSelection,
} from "@/components/dashboard/customers/customer-picker";
import { AssetPicker } from "@/components/dashboard/equipment/asset-picker";

export interface AgreementFormData {
  contractName: string;
  startDate: string;
  endDate: string;
  frequency: string;
  visitsPerYear: string;
  annualPrice: string;
  notes: string;
  equipmentId: string;
}

export interface AgreementSaveData extends AgreementFormData {
  customerId: string;
}

interface ServiceAgreementDialogProps {
  agreement: AgreementFormData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: AgreementSaveData) => void;
  loading: boolean;
  /** Pre-filled customerId (when opening from a customer page) */
  customerId?: string;
}

const emptyForm: AgreementFormData = {
  contractName: "",
  startDate: "",
  endDate: "",
  frequency: "annual",
  visitsPerYear: "2",
  annualPrice: "",
  notes: "",
  equipmentId: "",
};

const frequencyToVisits: Record<string, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
};

export function ServiceAgreementDialog({
  agreement,
  open,
  onOpenChange,
  onSave,
  loading,
  customerId,
}: ServiceAgreementDialogProps) {
  const [form, setForm] = useState<AgreementFormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customerSelection, setCustomerSelection] =
    useState<CustomerSelection | null>(null);

  const isEditing = !!agreement;
  const needsCustomerPicker = !customerId && !isEditing;

  useEffect(() => {
    if (agreement) {
      setForm({ ...agreement });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
    setCustomerSelection(null);
  }, [agreement, open]);

  function handleFrequencyChange(frequency: string) {
    const suggestedVisits = frequencyToVisits[frequency] ?? 2;
    setForm({
      ...form,
      frequency,
      visitsPerYear: String(suggestedVisits),
    });
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};
    if (needsCustomerPicker && !customerSelection) {
      newErrors.customer = "Customer is required";
    }
    if (
      needsCustomerPicker &&
      customerSelection?.type === "new" &&
      (!customerSelection.firstName.trim() || !customerSelection.lastName.trim())
    ) {
      newErrors.customer = "First and last name are required";
    }
    if (!form.contractName.trim()) newErrors.contractName = "Required";
    if (!form.startDate) newErrors.startDate = "Required";
    if (!form.endDate) newErrors.endDate = "Required";
    if (form.startDate && form.endDate && form.startDate >= form.endDate) {
      newErrors.endDate = "Must be after start date";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validateForm()) return;

    let resolvedCustomerId = customerId ?? "";
    if (customerSelection?.type === "existing") {
      resolvedCustomerId = customerSelection.id;
    }

    onSave({ ...form, customerId: resolvedCustomerId });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEditing ? "Edit Service Agreement" : "Add Service Agreement"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer picker — only shown on standalone page for new agreements */}
          {needsCustomerPicker && (
            <div className="space-y-1">
              <Label className="font-body">Customer *</Label>
              <CustomerPicker
                value={customerSelection}
                onChange={setCustomerSelection}
                error={errors.customer}
              />
              {errors.customer && (
                <p className="text-xs text-destructive">{errors.customer}</p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label className="font-body">Equipment / Asset</Label>
            <AssetPicker
              customerId={
                customerId ??
                (customerSelection?.type === "existing"
                  ? customerSelection.id
                  : null)
              }
              value={form.equipmentId || null}
              onChange={(id) =>
                setForm({ ...form, equipmentId: id ?? "" })
              }
            />
          </div>

          <div className="space-y-1">
            <Label className="font-body">Agreement Name *</Label>
            <Input
              value={form.contractName}
              onChange={(e) =>
                setForm({ ...form, contractName: e.target.value })
              }
              placeholder="e.g., Annual AC Maintenance Plan"
            />
            {errors.contractName && (
              <p className="text-xs text-destructive">
                {errors.contractName}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="font-body">Start Date *</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
              />
              {errors.startDate && (
                <p className="text-xs text-destructive">
                  {errors.startDate}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="font-body">End Date *</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm({ ...form, endDate: e.target.value })
                }
              />
              {errors.endDate && (
                <p className="text-xs text-destructive">
                  {errors.endDate}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="font-body">Frequency</Label>
              <Select
                value={form.frequency}
                onValueChange={handleFrequencyChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="semi_annual">Semi-annual</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="font-body">Visits / Year</Label>
              <Input
                type="number"
                min="1"
                value={form.visitsPerYear}
                onChange={(e) =>
                  setForm({ ...form, visitsPerYear: e.target.value })
                }
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="font-body">Annual Price</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.annualPrice}
                onChange={(e) =>
                  setForm({ ...form, annualPrice: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="font-body">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Terms, conditions, or other details..."
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
