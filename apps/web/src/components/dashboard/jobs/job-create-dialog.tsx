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
import { TimePicker } from "@/components/ui/time-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ScrollFadeArea } from "@/components/reusable/scroll-fade-area";
import {
  IconPencil,
  IconPlus,
  IconTrash,
  IconPackage,
  IconLayoutSidebar,
  IconMaximize,
  IconX,
} from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useViewPreference } from "@/hooks/use-view-preference";
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  JOB_PRIORITIES,
  JOB_PRIORITY_LABELS,
  ITEM_TYPE_LABELS,
} from "@/lib/constants/job-options";
import {
  CustomerPicker,
  type CustomerSelection,
} from "@/components/dashboard/customers/customer-picker";
import {
  CatalogItemPicker,
  type CatalogPickerItem,
} from "@/components/dashboard/catalog/catalog-item-picker";
import { createCustomer } from "@/actions/customers";
import { toast } from "sonner";
import type { JobDetail } from "./job-detail-sheet";

interface JobCreateDialogProps {
  job?: JobDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: JobFormData) => void;
  loading: boolean;
  defaultTaxRate?: string;
  initialStatus?: string;
  /** Pre-fill customer when creating from customer detail page */
  defaultCustomer?: { id: string; firstName: string; lastName: string } | null;
}

export interface LineItemFormData {
  description: string;
  itemType: string;
  quantity: string;
  unitPrice: string;
  catalogItemId: string | null;
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
  lineItems: LineItemFormData[];
}

interface NewItemForm {
  description: string;
  itemType: string;
  quantity: string;
  unitPrice: string;
  catalogItemId: string | null;
  catalogItemLabel: string;
}

const emptyItemForm: NewItemForm = {
  description: "",
  itemType: "labor",
  quantity: "1",
  unitPrice: "",
  catalogItemId: null,
  catalogItemLabel: "",
};

const emptyForm: Omit<JobFormData, "lineItems"> = {
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

export function JobCreateDialog({
  job,
  open,
  onOpenChange,
  onSave,
  loading,
  defaultTaxRate,
  initialStatus,
  defaultCustomer,
}: JobCreateDialogProps) {
  const [form, setForm] = useState(emptyForm);
  const [lineItems, setLineItems] = useState<LineItemFormData[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof emptyForm, string>>>({});
  const [customerSelection, setCustomerSelection] =
    useState<CustomerSelection | null>(null);
  const [taxEditable, setTaxEditable] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // New line item form
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState<NewItemForm>(emptyItemForm);

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
      setCustomerSelection({
        type: "existing",
        id: job.customerId,
        firstName: job.customerFirstName ?? "",
        lastName: job.customerLastName ?? "",
        address: null,
        city: null,
        state: null,
        zipCode: null,
      });
      setTaxEditable(true);
    } else {
      const defaultTaxPct = defaultTaxRate
        ? (parseFloat(defaultTaxRate) * 100).toString()
        : "0";
      setForm({ ...emptyForm, taxRate: defaultTaxPct });
      setCustomerSelection(
        defaultCustomer
          ? {
              type: "existing" as const,
              id: defaultCustomer.id,
              firstName: defaultCustomer.firstName,
              lastName: defaultCustomer.lastName,
              address: null,
              city: null,
              state: null,
              zipCode: null,
            }
          : null,
      );
      setTaxEditable(false);
    }
    setLineItems([]);
    setErrors({});
    setCreatingCustomer(false);
    setShowAddItem(false);
    setItemForm(emptyItemForm);
  }, [job, open, defaultTaxRate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Partial<Record<keyof typeof emptyForm, string>> = {};

    if (isEditing) {
      if (!form.customerId) newErrors.customerId = "Customer is required";
    } else {
      if (!customerSelection) {
        newErrors.customerId = "Customer is required";
      } else if (
        customerSelection.type === "new" &&
        (!customerSelection.firstName.trim() || !customerSelection.lastName.trim())
      ) {
        newErrors.customerId = "First name and last name are required";
      }
    }

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

    let customerId: string;

    if (isEditing) {
      customerId = form.customerId;
    } else if (customerSelection!.type === "new") {
      setCreatingCustomer(true);
      const phone = customerSelection!.type === "new" ? customerSelection!.phone.replace(/\D/g, "") : "";
      const result = await createCustomer({
        firstName: customerSelection!.type === "new" ? customerSelection!.firstName.trim() : "",
        lastName: customerSelection!.type === "new" ? customerSelection!.lastName.trim() : "",
        phone: phone || undefined,
        email: customerSelection!.type === "new" && customerSelection!.email.trim() ? customerSelection!.email.trim() : undefined,
      });
      setCreatingCustomer(false);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      customerId = result.data.id;
      toast.success(`Customer "${result.data.firstName} ${result.data.lastName}" created`);
    } else {
      customerId = customerSelection!.id;
    }

    const taxDecimal = taxRateNum / 100;
    onSave({ ...form, customerId, taxRate: taxDecimal.toString(), status: initialStatus, lineItems });
  }

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleCustomerChange(selection: CustomerSelection | null) {
    setCustomerSelection(selection);
    if (errors.customerId) {
      setErrors((prev) => ({ ...prev, customerId: undefined }));
    }
    if (selection?.type === "existing" && selection.address && !form.address) {
      updateField("address", selection.address);
    }
  }

  function handleAddItem() {
    if (!itemForm.description.trim() || !itemForm.unitPrice.trim()) return;
    setLineItems((prev) => [
      ...prev,
      {
        description: itemForm.description,
        itemType: itemForm.itemType,
        quantity: itemForm.quantity,
        unitPrice: itemForm.unitPrice,
        catalogItemId: itemForm.catalogItemId,
      },
    ]);
    setItemForm(emptyItemForm);
    setShowAddItem(false);
  }

  function removeItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Compute summary
  const subtotal = lineItems.reduce(
    (sum, li) =>
      sum + parseFloat(li.quantity || "0") * parseFloat(li.unitPrice || "0"),
    0,
  );
  const taxRateNum = parseFloat(form.taxRate || "0") / 100;
  const taxAmount = subtotal * taxRateNum;
  const total = subtotal + taxAmount;

  const isBusy = loading || creatingCustomer;
  const { mode, setMode } = useViewPreference("jobs");
  const isSidebar = mode === "sidebar";

  const header = (
    <div className="flex items-center justify-between px-6 pt-6 pb-2">
      <div>
        <h2 className="font-heading text-lg font-semibold">
          {isEditing ? "Edit Job" : "Create Job"}
        </h2>
        <p className="text-sm text-muted-foreground font-body">
          {isEditing ? "Update job details." : "Create a new job for a customer."}
        </p>
      </div>
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => setMode(isSidebar ? "dialog" : "sidebar")} type="button">
                {isSidebar ? <IconMaximize className="h-4 w-4" /> : <IconLayoutSidebar className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isSidebar ? "Switch to dialog view" : "Switch to sidebar view"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => onOpenChange(false)} type="button">
                <IconX className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Close</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );

  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 min-h-0 flex-1">
      <ScrollFadeArea className="flex-1">
        <div className={`flex gap-6 px-6 pb-3 ${isSidebar ? "flex-col" : "flex-col lg:flex-row"}`}>
              {/* Left column: Job details */}
              <div className="flex-1 min-w-0 space-y-4">
          {/* Customer picker (not shown when editing since customerId can't change) */}
          {!isEditing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-body">
                  Customer <span className="text-destructive">*</span>
                </Label>
                {customerSelection?.type !== "new" && (
                  <button
                    type="button"
                    onClick={() =>
                      handleCustomerChange({
                        type: "new",
                        firstName: "",
                        lastName: "",
                        phone: "",
                        email: "",
                      })
                    }
                    className="flex items-center gap-1 text-xs text-brand hover:underline cursor-pointer font-body"
                  >
                    <IconPlus className="h-3 w-3" />
                    New Customer
                  </button>
                )}
              </div>
              <CustomerPicker
                value={customerSelection}
                onChange={handleCustomerChange}
                error={errors.customerId}
              />
              {errors.customerId && customerSelection?.type !== "new" && (
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
              <Select value={form.serviceType} onValueChange={(v) => updateField("serviceType", v)}>
                <SelectTrigger className="h-9 font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((st) => (
                    <SelectItem key={st} value={st} className="font-body">
                      {SERVICE_TYPE_LABELS[st]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Priority</Label>
              <Select value={form.priority} onValueChange={(v) => updateField("priority", v)}>
                <SelectTrigger className="h-9 font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="font-body">
                      {JOB_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledDate" className="font-body">
                Date <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                id="scheduledDate"
                value={form.scheduledDate}
                onChange={(v) => updateField("scheduledDate", v)}
                placeholder="Pick date"
              />
              {errors.scheduledDate && (
                <p className="text-sm text-destructive">{errors.scheduledDate}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledStart" className="font-body">
                Start Time
              </Label>
              <TimePicker
                id="scheduledStart"
                value={form.scheduledStart}
                onChange={(v) => updateField("scheduledStart", v)}
                placeholder="Start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledEnd" className="font-body">
                End Time
              </Label>
              <TimePicker
                id="scheduledEnd"
                value={form.scheduledEnd}
                onChange={(v) => updateField("scheduledEnd", v)}
                placeholder="End"
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

              {/* Right column: Line items (only for create mode) */}
              {!isEditing && (
                <div className="lg:w-[300px] shrink-0 space-y-3 lg:border-l lg:border-border lg:pl-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconPackage className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wider font-body">
                        Line Items
                      </span>
                    </div>
                    {lineItems.length > 0 && (
                      <span className="text-xs text-muted-foreground font-body">
                        {lineItems.length} {lineItems.length === 1 ? "item" : "items"}
                      </span>
                    )}
                  </div>

                  {/* Existing items */}
                  {lineItems.length > 0 && (
                    <div className="rounded-md border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground font-body text-xs">
                              Item
                            </th>
                            <th className="px-2 py-1.5 text-right font-medium text-muted-foreground font-body text-xs w-12">
                              Qty
                            </th>
                            <th className="px-2 py-1.5 text-right font-medium text-muted-foreground font-body text-xs w-16">
                              Price
                            </th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((li, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-border last:border-0"
                            >
                              <td className="px-2 py-1.5 font-body">
                                <div className="text-xs text-foreground truncate max-w-[160px]">
                                  {li.description}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {ITEM_TYPE_LABELS[li.itemType] ?? li.itemType}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-right text-xs text-muted-foreground font-body">
                                {li.quantity}
                              </td>
                              <td className="px-2 py-1.5 text-right text-xs font-medium font-body">
                                ${(
                                  parseFloat(li.quantity || "0") *
                                  parseFloat(li.unitPrice || "0")
                                ).toFixed(2)}
                              </td>
                              <td className="px-1 py-1.5">
                                <button
                                  type="button"
                                  onClick={() => removeItem(idx)}
                                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive cursor-pointer"
                                >
                                  <IconTrash className="h-3 w-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Add Line Item button — collapses when form is open */}
                  <div
                    className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
                    style={{ gridTemplateRows: showAddItem ? "0fr" : "1fr", opacity: showAddItem ? 0 : 1 }}
                  >
                    <div className="overflow-hidden">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddItem(true)}
                        tabIndex={showAddItem ? -1 : 0}
                        className="w-full cursor-pointer text-xs"
                      >
                        <IconPlus className="mr-1.5 h-3.5 w-3.5" />
                        Add Line Item
                      </Button>
                    </div>
                  </div>

                  {/* Add item form — expands when open */}
                  <div
                    className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
                    style={{ gridTemplateRows: showAddItem ? "1fr" : "0fr", opacity: showAddItem ? 1 : 0 }}
                  >
                    <div className="overflow-hidden">
                      <div className="rounded-md border border-border p-2.5 space-y-2">
                        <div>
                          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                            From catalog (optional)
                          </label>
                          <CatalogItemPicker
                            selectedId={itemForm.catalogItemId}
                            selectedLabel={itemForm.catalogItemLabel}
                            onSelect={(item: CatalogPickerItem | null) => {
                              if (item) {
                                setItemForm((f) => ({
                                  ...f,
                                  catalogItemId: item.id,
                                  catalogItemLabel: item.name,
                                  description: item.name,
                                  unitPrice: parseFloat(item.unitPrice).toFixed(2),
                                  itemType: item.itemType,
                                }));
                              } else {
                                setItemForm((f) => ({
                                  ...f,
                                  catalogItemId: null,
                                  catalogItemLabel: "",
                                }));
                              }
                            }}
                          />
                        </div>
                        <Input
                          placeholder="Description"
                          value={itemForm.description}
                          onChange={(e) =>
                            setItemForm((f) => ({ ...f, description: e.target.value }))
                          }
                          className="text-sm h-8"
                          tabIndex={showAddItem ? 0 : -1}
                        />
                        <div className="flex gap-2">
                          <Select value={itemForm.itemType} onValueChange={(v) => setItemForm((f) => ({ ...f, itemType: v }))}>
                            <SelectTrigger className="h-8 text-xs font-body flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(ITEM_TYPE_LABELS).map(([val, label]) => (
                                <SelectItem key={val} value={val} className="text-xs font-body">
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Qty"
                            value={itemForm.quantity}
                            onChange={(e) =>
                              setItemForm((f) => ({ ...f, quantity: e.target.value }))
                            }
                            className="w-14 text-sm h-8"
                            tabIndex={showAddItem ? 0 : -1}
                          />
                          <Input
                            placeholder="Price"
                            value={itemForm.unitPrice}
                            onChange={(e) =>
                              setItemForm((f) => ({ ...f, unitPrice: e.target.value }))
                            }
                            className="w-20 text-sm h-8"
                            tabIndex={showAddItem ? 0 : -1}
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs cursor-pointer"
                            tabIndex={showAddItem ? 0 : -1}
                            onClick={() => {
                              setShowAddItem(false);
                              setItemForm(emptyItemForm);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 text-xs bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
                            tabIndex={showAddItem ? 0 : -1}
                            onClick={handleAddItem}
                            disabled={!itemForm.description.trim() || !itemForm.unitPrice.trim()}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  {lineItems.length > 0 && (
                    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground font-body">
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      {taxRateNum > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground font-body">
                          <span>Tax ({form.taxRate}%)</span>
                          <span>${taxAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-border pt-1.5 flex justify-between text-sm font-semibold font-body">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {lineItems.length === 0 && !showAddItem && (
                    <p className="text-xs text-muted-foreground text-center py-4 font-body">
                      Line items are optional during creation.
                      <br />
                      You can also add them later.
                    </p>
                  )}
                </div>
              )}
            </div>
          </ScrollFadeArea>
          <div className="flex justify-end gap-2 px-6 pb-6 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isBusy}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
              disabled={isBusy}
            >
              {creatingCustomer
                ? "Creating customer..."
                : loading
                  ? "Saving..."
                  : isEditing
                    ? "Save Changes"
                    : "Create Job"}
            </Button>
          </div>
        </form>
  );

  if (isSidebar) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="p-0 overflow-hidden flex flex-col sm:max-w-lg w-full">
          <SheetTitle className="sr-only">{isEditing ? "Edit Job" : "Create Job"}</SheetTitle>
          <SheetDescription className="sr-only">{isEditing ? "Update job details." : "Create a new job."}</SheetDescription>
          {header}
          {formContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] !grid-rows-[auto_1fr] max-h-[90vh] overflow-hidden p-0">
        {header}
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
