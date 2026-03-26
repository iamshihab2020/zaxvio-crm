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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollFadeArea } from "@/components/reusable/scroll-fade-area";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  IconPencil,
  IconUser,
  IconFileInvoice,
  IconAlertCircle,
  IconSearch,
  IconCheck,
  IconSelector,
} from "@tabler/icons-react";
import { getCustomers } from "@/actions/customers";

export interface InvoiceFormData {
  customerId: string;
  issuedDate: string;
  dueDate: string;
  taxRate: string;
  discountAmount: string;
  notes: string;
}

interface InvoiceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: InvoiceFormData) => void;
  loading: boolean;
  defaultTaxRate?: string;
}

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string;
}

const emptyForm: InvoiceFormData = {
  customerId: "",
  issuedDate: new Date().toISOString().split("T")[0],
  dueDate: "",
  taxRate: "0",
  discountAmount: "0",
  notes: "",
};

export function InvoiceCreateDialog({
  open,
  onOpenChange,
  onSave,
  loading,
  defaultTaxRate,
}: InvoiceCreateDialogProps) {
  const [form, setForm] = useState<InvoiceFormData>(emptyForm);
  const [errors, setErrors] = useState<
    Partial<Record<keyof InvoiceFormData, string>>
  >({});
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState("");
  const [taxEditable, setTaxEditable] = useState(false);

  // Popover customer picker
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    const defaultTaxPct = defaultTaxRate
      ? (parseFloat(defaultTaxRate) * 100).toString()
      : "0";
    setForm({ ...emptyForm, taxRate: defaultTaxPct });
    setSelectedCustomerLabel("");
    setErrors({});
    setTaxEditable(false);
    setCustomerSearch("");
    setPopoverOpen(false);
  }, [open, defaultTaxRate]);

  // Prefetch customers when dialog opens so data is ready instantly
  useEffect(() => {
    if (!open) return;
    getCustomers({ search: "", limit: 10 }).then((result) => {
      if (result.data) {
        setCustomers(
          result.data.map((c: CustomerOption) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
          })),
        );
      }
    });
  }, [open]);

  // Refetch when user searches inside the popover
  useEffect(() => {
    if (!popoverOpen || customerSearch === "") return;
    const timer = setTimeout(async () => {
      const result = await getCustomers({ search: customerSearch, limit: 10 });
      if (result.data) {
        setCustomers(
          result.data.map((c: CustomerOption) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
          })),
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, popoverOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Partial<Record<keyof InvoiceFormData, string>> = {};

    if (!form.customerId) {
      newErrors.customerId = "Customer is required";
    }

    const taxRateNum = parseFloat(form.taxRate || "0");
    if (isNaN(taxRateNum) || taxRateNum < 0 || taxRateNum > 100) {
      newErrors.taxRate = "Tax rate must be between 0 and 100";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const taxDecimal = taxRateNum / 100;
    onSave({ ...form, taxRate: taxDecimal.toString() });
  }

  function updateField(field: keyof InvoiceFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleCustomerSelect(customer: CustomerOption) {
    updateField("customerId", customer.id);
    setSelectedCustomerLabel(`${customer.firstName} ${customer.lastName}`);
    setPopoverOpen(false);
    setCustomerSearch("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] !grid-rows-[auto_1fr] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-heading">Create Invoice</DialogTitle>
          <DialogDescription className="font-body">
            Create a new invoice to send to your customer and track payment.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 min-h-0"
        >
          <ScrollFadeArea className="flex-1">
            <div className="space-y-4 px-3 pb-3">
              {/* Section 1: Customer */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <IconUser className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider font-body">
                  Customer
                </span>
              </div>

              {/* Customer picker — existing only (Popover) */}
              <div className="space-y-2">
                <Label className="font-body text-muted-foreground">
                  Customer <span className="text-destructive">*</span>
                </Label>
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex h-9 w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-body cursor-pointer",
                        errors.customerId ? "border-destructive" : "border-border",
                        "bg-card",
                        !selectedCustomerLabel && "text-muted-foreground",
                      )}
                    >
                      {selectedCustomerLabel || "Select customer..."}
                      <IconSelector className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[calc(100vw-4rem)] sm:w-[340px] p-0"
                    align="start"
                  >
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <IconSearch className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search customers..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="pl-8 h-8"
                        />
                      </div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                      {customers.length === 0 && (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          No customers found
                        </p>
                      )}
                      {customers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleCustomerSelect(c)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer font-body"
                        >
                          {form.customerId === c.id && (
                            <IconCheck className="h-4 w-4 text-brand shrink-0" />
                          )}
                          <span className={cn(form.customerId !== c.id && "pl-6")}>
                            {c.firstName} {c.lastName}
                          </span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                {errors.customerId && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <IconAlertCircle className="h-3 w-3 shrink-0" />
                    {errors.customerId}
                  </p>
                )}
              </div>

              {/* Separator */}
              <div className="border-t border-border" />

              {/* Section 2: Invoice Details */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <IconFileInvoice className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider font-body">
                  Invoice Details
                </span>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issuedDate" className="font-body text-muted-foreground">
                    Issued Date
                  </Label>
                  <Input
                    id="issuedDate"
                    type="date"
                    value={form.issuedDate}
                    onChange={(e) => updateField("issuedDate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate" className="font-body text-muted-foreground">
                    Due Date
                  </Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => updateField("dueDate", e.target.value)}
                  />
                </div>
              </div>

              {/* Tax & Discount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxRate" className="font-body text-muted-foreground">
                    Tax Rate (%)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="taxRate"
                      value={form.taxRate}
                      onChange={(e) => updateField("taxRate", e.target.value)}
                      placeholder="8.25"
                      readOnly={!taxEditable}
                      className={cn(
                        !taxEditable && "bg-muted text-muted-foreground",
                        errors.taxRate && "border-destructive",
                      )}
                    />
                    {!taxEditable && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0 h-9 w-9"
                        onClick={() => setTaxEditable(true)}
                        title="Override tax rate"
                      >
                        <IconPencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {!taxEditable && (
                    <p className="text-xs text-muted-foreground">
                      From your business settings
                    </p>
                  )}
                  {errors.taxRate && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <IconAlertCircle className="h-3 w-3 shrink-0" />
                      {errors.taxRate}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount" className="font-body text-muted-foreground">
                    Discount ($)
                  </Label>
                  <Input
                    id="discount"
                    value={form.discountAmount}
                    onChange={(e) =>
                      updateField("discountAmount", e.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="font-body text-muted-foreground">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Invoice notes..."
                  rows={3}
                />
              </div>
            </div>
          </ScrollFadeArea>
          <DialogFooter className="shrink-0 border-t pt-4">
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
              className="bg-brand text-brand-foreground hover:bg-brand/90 min-w-[160px]"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
