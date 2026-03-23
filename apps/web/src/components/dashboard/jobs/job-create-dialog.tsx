"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconSearch, IconCheck, IconSelector, IconPencil } from "@tabler/icons-react";
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  JOB_PRIORITIES,
  JOB_PRIORITY_LABELS,
  type ServiceType,
  type JobPriority,
} from "@/lib/constants/job-options";
import { getCustomers } from "@/actions/customers";
import type { JobDetail } from "./job-detail-sheet";

interface JobCreateDialogProps {
  job?: JobDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: JobFormData) => void;
  loading: boolean;
  defaultTaxRate?: string;
  initialStatus?: string;
}

export interface JobFormData {
  customerId: string;
  title: string;
  serviceType: string;
  priority: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  address: string;
  description: string;
  taxRate: string;
  notes: string;
  status?: string;
}

const emptyForm: JobFormData = {
  customerId: "",
  title: "",
  serviceType: "repair",
  priority: "standard",
  scheduledDate: "",
  scheduledStart: "",
  scheduledEnd: "",
  address: "",
  description: "",
  taxRate: "0",
  notes: "",
};

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string;
  address: string | null;
}

export function JobCreateDialog({
  job,
  open,
  onOpenChange,
  onSave,
  loading,
  defaultTaxRate,
  initialStatus,
}: JobCreateDialogProps) {
  const [form, setForm] = useState<JobFormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof JobFormData, string>>>({});
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState("");
  const [taxEditable, setTaxEditable] = useState(false);

  const isEditing = !!job;

  useEffect(() => {
    if (job) {
      setForm({
        customerId: job.customerId,
        title: job.title,
        serviceType: job.serviceType,
        priority: job.priority,
        scheduledDate: job.scheduledDate,
        scheduledStart: job.scheduledStart ?? "",
        scheduledEnd: job.scheduledEnd ?? "",
        address: job.address ?? "",
        description: job.description ?? "",
        taxRate: job.taxRate ? (parseFloat(job.taxRate) * 100).toString() : "0",
        notes: job.notes ?? "",
      });
      const name = `${job.customerFirstName ?? ""} ${job.customerLastName ?? ""}`.trim();
      setSelectedCustomerLabel(name);
      setTaxEditable(true);
    } else {
      // For new jobs, pre-fill with tenant's default tax rate (converted to %)
      const defaultTaxPct = defaultTaxRate
        ? (parseFloat(defaultTaxRate) * 100).toString()
        : "0";
      setForm({ ...emptyForm, taxRate: defaultTaxPct });
      setSelectedCustomerLabel("");
      setTaxEditable(false);
    }
    setErrors({});
  }, [job, open, defaultTaxRate]);

  // Debounced customer search
  const fetchCustomers = useCallback(async (search: string) => {
    const result = await getCustomers({ search, limit: 10 });
    if (result.data) {
      setCustomers(
        result.data.map((c: CustomerOption) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          address: c.address,
        })),
      );
    }
  }, []);

  useEffect(() => {
    if (!customerPopoverOpen) return;
    const timer = setTimeout(() => fetchCustomers(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch, customerPopoverOpen, fetchCustomers]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Partial<Record<keyof JobFormData, string>> = {};
    if (!form.customerId) newErrors.customerId = "Customer is required";
    if (!form.title.trim()) newErrors.title = "Title is required";
    if (!form.scheduledDate) newErrors.scheduledDate = "Date is required";

    const taxRateNum = parseFloat(form.taxRate || "0");
    if (form.taxRate && isNaN(taxRateNum)) {
      newErrors.taxRate = "Tax rate must be a valid number";
    } else if (taxRateNum < 0 || taxRateNum > 100) {
      newErrors.taxRate = "Tax rate must be between 0 and 100";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Convert percentage to decimal for the API (e.g. 8.25 → 0.0825)
    const taxDecimal = taxRateNum / 100;
    onSave({ ...form, taxRate: taxDecimal.toString(), status: initialStatus });
  }

  function updateField(field: keyof JobFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function selectCustomer(customer: CustomerOption) {
    updateField("customerId", customer.id);
    const label = `${customer.firstName} ${customer.lastName}`;
    setSelectedCustomerLabel(label);
    // Auto-fill address if empty
    if (!form.address && customer.address) {
      updateField("address", customer.address);
    }
    setCustomerPopoverOpen(false);
    setCustomerSearch("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] !grid-rows-[auto_1fr] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEditing ? "Edit Job" : "Create Job"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update job details."
              : "Create a new job for a customer."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 min-h-0">
          <ScrollArea className="flex-1">
            <div className="space-y-4 pr-3">
          {/* Customer picker (not shown when editing since customerId can't change) */}
          {!isEditing && (
            <div className="space-y-2">
              <Label className="font-body">
                Customer <span className="text-destructive">*</span>
              </Label>
              <Popover
                open={customerPopoverOpen}
                onOpenChange={setCustomerPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex h-9 w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm font-body cursor-pointer",
                      !selectedCustomerLabel && "text-muted-foreground",
                    )}
                  >
                    {selectedCustomerLabel || "Select customer..."}
                    <IconSelector className="h-4 w-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-4rem)] sm:w-[540px] p-0" align="start">
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
                        onClick={() => selectCustomer(c)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer font-body"
                      >
                        {form.customerId === c.id && (
                          <IconCheck className="h-4 w-4 text-brand shrink-0" />
                        )}
                        <span
                          className={cn(
                            form.customerId !== c.id && "pl-6",
                          )}
                        >
                          {c.firstName} {c.lastName}
                        </span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {errors.customerId && (
                <p className="text-sm text-destructive">{errors.customerId}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title" className="font-body">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="AC repair for living room"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-body">Service Type</Label>
              <select
                value={form.serviceType}
                onChange={(e) => updateField("serviceType", e.target.value)}
                className="flex h-9 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-body"
              >
                {SERVICE_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {SERVICE_TYPE_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Priority</Label>
              <select
                value={form.priority}
                onChange={(e) => updateField("priority", e.target.value)}
                className="flex h-9 w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-body"
              >
                {JOB_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {JOB_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledDate" className="font-body">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="scheduledDate"
                type="date"
                value={form.scheduledDate}
                onChange={(e) => updateField("scheduledDate", e.target.value)}
              />
              {errors.scheduledDate && (
                <p className="text-sm text-destructive">{errors.scheduledDate}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledStart" className="font-body">
                Start Time
              </Label>
              <Input
                id="scheduledStart"
                type="time"
                value={form.scheduledStart}
                onChange={(e) => updateField("scheduledStart", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledEnd" className="font-body">
                End Time
              </Label>
              <Input
                id="scheduledEnd"
                type="time"
                value={form.scheduledEnd}
                onChange={(e) => updateField("scheduledEnd", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="font-body">
              Address
            </Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="123 Main St, Houston, TX"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="font-body">
              Description
            </Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Describe the job..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taxRate" className="font-body">
                Tax Rate (%)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="taxRate"
                  value={form.taxRate}
                  onChange={(e) => updateField("taxRate", e.target.value)}
                  placeholder="8.25"
                  readOnly={!taxEditable}
                  className={cn(!taxEditable && "bg-muted text-muted-foreground")}
                />
                {!taxEditable && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-9 w-9"
                    onClick={() => setTaxEditable(true)}
                    title="Override tax rate for this job"
                  >
                    <IconPencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {taxEditable
                  ? "e.g. 8.25 for 8.25%"
                  : "Using default rate. Click the pencil to override."}
              </p>
              {errors.taxRate && (
                <p className="text-sm text-destructive">{errors.taxRate}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="font-body">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Internal notes..."
              rows={2}
            />
          </div>

            </div>
          </ScrollArea>
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
              className="bg-brand text-brand-foreground hover:bg-brand/90"
              disabled={loading}
            >
              {loading
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
