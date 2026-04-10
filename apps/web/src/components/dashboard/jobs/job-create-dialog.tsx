"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
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
import { motion, AnimatePresence } from "motion/react";
import {
  IconBriefcase,
  IconUser,
  IconClock,
  IconMapPin,
  IconFileDescription,
  IconNotes,
  IconPackage,
  IconPencil,
  IconPlus,
  IconTrash,
  IconLayoutSidebar,
  IconMaximize,
  IconX,
  IconCheck,
  IconTool,
  IconSettings,
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
import { getJobAssignees } from "@/actions/jobs";
import { AssetPicker } from "@/components/dashboard/equipment/asset-picker";
import { AssigneePicker, type AssigneeMember } from "./assignee-picker";
import { toast } from "sonner";
import type { JobDetail } from "./job-detail-sheet";

/* ── Section wrapper with icon ── */
function FormSection({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-body">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ── Animated error message ── */
function FieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="text-xs text-destructive"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

interface JobCreateDialogProps {
  job?: JobDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: JobFormData) => void;
  loading: boolean;
  defaultTaxRate?: string;
  initialStatus?: string;
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
  equipmentId: string;
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
  assigneeId: string | null;
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
  equipmentId: "",
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
  assigneeId: null,
};

const PRIORITY_COLORS: Record<string, string> = {
  standard: "bg-blue-500",
  urgent: "bg-amber-500",
  emergency: "bg-red-500",
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
  const [members, setMembers] = useState<AssigneeMember[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState<NewItemForm>(emptyItemForm);

  const isEditing = !!job;

  useEffect(() => {
    if (job) {
      setForm({
        customerId: job.customerId,
        equipmentId: job.equipmentId ?? "",
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
        assigneeId: job.assigneeId ?? null,
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

  useEffect(() => {
    if (open) {
      getJobAssignees().then((res) => {
        if (res.data) setMembers(res.data);
      });
    }
  }, [open]);

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
    setForm((prev) => ({ ...prev, equipmentId: "" }));
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

  const subtotal = lineItems.reduce(
    (sum, li) =>
      sum + parseFloat(li.quantity || "0") * parseFloat(li.unitPrice || "0"),
    0,
  );
  const taxRateNum = parseFloat(form.taxRate || "0") / 100;
  const taxAmount = subtotal * taxRateNum;
  const total = subtotal + taxAmount;

  const isBusy = loading || creatingCustomer;
  const { mode, setMode, sidebarWidth: prefWidth, setSidebarWidth: setPrefWidth } = useViewPreference("jobs");
  const isSidebar = mode === "sidebar";

  /* ── Resizable sidebar width ── */
  const [liveSidebarWidth, setLiveSidebarWidth] = useState(prefWidth);
  const dragWidthRef = useRef(prefWidth);

  useEffect(() => {
    setLiveSidebarWidth(prefWidth);
  }, [prefWidth]);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragWidthRef.current = liveSidebarWidth;
      const onMove = (ev: MouseEvent) => {
        const w = Math.max(400, Math.min(1200, window.innerWidth - ev.clientX));
        dragWidthRef.current = w;
        setLiveSidebarWidth(w);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setPrefWidth(dragWidthRef.current);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [liveSidebarWidth, setPrefWidth],
  );

  /* ── Header ── */
  const header = (
    <div className="flex items-center justify-between px-6 pt-5 pb-3">
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex items-center justify-center h-9 w-9 rounded-lg",
          PRIORITY_COLORS[form.priority] ?? "bg-blue-500",
        )}>
          <IconBriefcase className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold leading-tight">
            {isEditing ? "Edit Job" : "Create Job"}
          </h2>
          <p className="text-xs text-muted-foreground font-body mt-0.5">
            {isEditing ? "Update job details." : "Create a new job for a customer."}
          </p>
        </div>
      </div>
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setMode(isSidebar ? "dialog" : "sidebar")} type="button">
                {isSidebar ? <IconMaximize className="h-3.5 w-3.5" /> : <IconLayoutSidebar className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isSidebar ? "Switch to dialog" : "Switch to sidebar"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => onOpenChange(false)} type="button">
                <IconX className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Close</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );

  /* ── Form content ── */
  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
      <ScrollFadeArea className="flex-1">
        <div className={cn(
          "px-6 pb-4",
          !isSidebar && !isEditing
            ? "lg:grid lg:grid-cols-[1fr_280px] lg:gap-6"
            : "space-y-5",
        )}>
          {/* ── Left column: Job details ── */}
          <div className="space-y-5">
            {/* Customer picker */}
            {!isEditing && (
              <FormSection icon={IconUser} label="Customer">
                <div className="flex items-center justify-between -mt-1">
                  <span className="text-xs text-muted-foreground">
                    Select or create a customer <span className="text-destructive">*</span>
                  </span>
                  {customerSelection?.type !== "new" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleCustomerChange({
                          type: "new",
                          firstName: "",
                          lastName: "",
                          phone: "",
                          email: "",
                        })
                      }
                      className="gap-1 text-xs text-brand hover:underline font-body h-auto p-0"
                    >
                      <IconPlus className="h-3 w-3" />
                      New Customer
                    </Button>
                  )}
                </div>
                <CustomerPicker
                  value={customerSelection}
                  onChange={handleCustomerChange}
                  error={errors.customerId}
                />
                <FieldError message={customerSelection?.type !== "new" ? errors.customerId : undefined} />
              </FormSection>
            )}

            {/* Equipment / Asset + Assignee */}
            <FormSection icon={IconSettings} label="Assignment">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Equipment / Asset</Label>
                  <AssetPicker
                    customerId={
                      isEditing
                        ? form.customerId
                        : customerSelection?.type === "existing"
                          ? customerSelection.id
                          : null
                    }
                    value={form.equipmentId || null}
                    onChange={(id) =>
                      setForm((prev) => ({ ...prev, equipmentId: id ?? "" }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Assignee</Label>
                  <AssigneePicker
                    value={form.assigneeId}
                    onChange={(id) => setForm((prev) => ({ ...prev, assigneeId: id }))}
                    members={members}
                  />
                </div>
              </div>
            </FormSection>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="font-body text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="AC repair for living room"
                className={cn(
                  "h-10 text-sm",
                  errors.title && "border-destructive focus-visible:ring-destructive/30",
                )}
              />
              <FieldError message={errors.title} />
            </div>

            {/* Service Type & Priority */}
            <FormSection icon={IconTool} label="Service">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Service Type</Label>
                  <Select value={form.serviceType} onValueChange={(v) => updateField("serviceType", v)}>
                    <SelectTrigger className="h-9 font-body text-sm">
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
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => updateField("priority", v)}>
                    <SelectTrigger className="h-9 font-body text-sm">
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
            </FormSection>

            {/* Date & Time */}
            <FormSection icon={IconClock} label="Schedule">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="scheduledDate" className="text-xs text-muted-foreground">
                    Date <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker
                    id="scheduledDate"
                    value={form.scheduledDate}
                    onChange={(v) => updateField("scheduledDate", v)}
                    placeholder="Pick date"
                  />
                  <FieldError message={errors.scheduledDate} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scheduledStart" className="text-xs text-muted-foreground">
                    Start Time
                  </Label>
                  <TimePicker
                    id="scheduledStart"
                    value={form.scheduledStart}
                    onChange={(v) => updateField("scheduledStart", v)}
                    placeholder="Start"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scheduledEnd" className="text-xs text-muted-foreground">
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
            </FormSection>

            {/* Address */}
            <FormSection icon={IconMapPin} label="Location">
              <Input
                id="address"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="123 Main St, Houston, TX"
                className="h-9 text-sm"
              />
            </FormSection>

            {/* Description */}
            <FormSection icon={IconFileDescription} label="Description">
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Describe the job..."
                rows={3}
                className="text-sm resize-none"
              />
            </FormSection>

            {/* Tax & Notes row */}
            <div className="grid grid-cols-2 gap-4">
              <FormSection icon={IconSettings} label="Tax Rate">
                <div className="flex items-center gap-2">
                  <Input
                    id="taxRate"
                    value={form.taxRate}
                    onChange={(e) => updateField("taxRate", e.target.value)}
                    placeholder="8.25"
                    readOnly={!taxEditable}
                    className={cn("h-9 text-sm", !taxEditable && "bg-muted text-muted-foreground")}
                  />
                  {!taxEditable && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 h-9 w-9 cursor-pointer"
                      onClick={() => setTaxEditable(true)}
                      title="Override tax rate for this job"
                    >
                      <IconPencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-[0.65rem] text-muted-foreground/70">
                  {taxEditable ? "e.g. 8.25 for 8.25%" : "Default rate. Click pencil to override."}
                </p>
                <FieldError message={errors.taxRate} />
              </FormSection>

              <FormSection icon={IconNotes} label="Notes">
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Internal notes..."
                  rows={2}
                  className="text-sm resize-none"
                />
              </FormSection>
            </div>
          </div>

          {/* ── Right column: Line items (create mode only) ── */}
          {!isEditing && (
            <div className={cn(
              "space-y-3",
              !isSidebar && "lg:border-l lg:border-border lg:pl-6",
            )}>
              <FormSection icon={IconPackage} label="Line Items">
                {lineItems.length > 0 && (
                  <span className="text-xs text-muted-foreground -mt-2 block">
                    {lineItems.length} {lineItems.length === 1 ? "item" : "items"}
                  </span>
                )}

                {/* Existing items */}
                <AnimatePresence>
                  {lineItems.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-md border border-border overflow-hidden"
                    >
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground font-body text-xs">Item</th>
                            <th className="px-2 py-1.5 text-right font-medium text-muted-foreground font-body text-xs w-12">Qty</th>
                            <th className="px-2 py-1.5 text-right font-medium text-muted-foreground font-body text-xs w-16">Price</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((li, idx) => (
                            <motion.tr
                              key={`${li.description}-${idx}`}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -8 }}
                              className="border-b border-border last:border-0"
                            >
                              <td className="px-2 py-1.5 font-body">
                                <div className="text-xs text-foreground truncate max-w-[160px]">{li.description}</div>
                                <div className="text-[10px] text-muted-foreground">{ITEM_TYPE_LABELS[li.itemType] ?? li.itemType}</div>
                              </td>
                              <td className="px-2 py-1.5 text-right text-xs text-muted-foreground font-body">{li.quantity}</td>
                              <td className="px-2 py-1.5 text-right text-xs font-medium font-body">
                                ${(parseFloat(li.quantity || "0") * parseFloat(li.unitPrice || "0")).toFixed(2)}
                              </td>
                              <td className="px-1 py-1.5">
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-5 w-5 text-muted-foreground hover:text-destructive cursor-pointer">
                                  <IconTrash className="h-3 w-3" />
                                </Button>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Add Line Item button */}
                <div
                  className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
                  style={{ gridTemplateRows: showAddItem ? "0fr" : "1fr", opacity: showAddItem ? 0 : 1 }}
                >
                  <div className="overflow-hidden">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddItem(true)} tabIndex={showAddItem ? -1 : 0} className="w-full cursor-pointer text-xs gap-1.5">
                      <IconPlus className="h-3.5 w-3.5" />
                      Add Line Item
                    </Button>
                  </div>
                </div>

                {/* Add item form */}
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
                        onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
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
                              <SelectItem key={val} value={val} className="text-xs font-body">{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input placeholder="Qty" value={itemForm.quantity} onChange={(e) => setItemForm((f) => ({ ...f, quantity: e.target.value }))} className="w-14 text-sm h-8" tabIndex={showAddItem ? 0 : -1} />
                        <Input placeholder="Price" value={itemForm.unitPrice} onChange={(e) => setItemForm((f) => ({ ...f, unitPrice: e.target.value }))} className="w-20 text-sm h-8" tabIndex={showAddItem ? 0 : -1} />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs cursor-pointer" tabIndex={showAddItem ? 0 : -1} onClick={() => { setShowAddItem(false); setItemForm(emptyItemForm); }}>
                          Cancel
                        </Button>
                        <Button type="button" size="sm" className="h-7 text-xs bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer" tabIndex={showAddItem ? 0 : -1} onClick={handleAddItem} disabled={!itemForm.description.trim() || !itemForm.unitPrice.trim()}>
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <AnimatePresence>
                  {lineItems.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="rounded-md border border-border bg-muted/20 p-3 space-y-1.5"
                    >
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
                    </motion.div>
                  )}
                </AnimatePresence>

                {lineItems.length === 0 && !showAddItem && (
                  <p className="text-xs text-muted-foreground text-center py-4 font-body">
                    Line items are optional during creation.
                    <br />
                    You can also add them later.
                  </p>
                )}
              </FormSection>
            </div>
          )}
        </div>
      </ScrollFadeArea>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-6 pb-5 pt-3 border-t border-border">
        <p className="text-[0.65rem] text-muted-foreground/50 hidden sm:block">
          Press <kbd className="px-1 py-0.5 rounded bg-muted text-[0.6rem] font-mono">Enter</kbd> to save
        </p>
        <div className="flex items-center gap-2 ml-auto">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isBusy} className="cursor-pointer text-muted-foreground">
            Cancel
          </Button>
          <Button type="submit" size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer gap-1.5 min-w-[120px]" disabled={isBusy}>
            {creatingCustomer ? (
              "Creating customer..."
            ) : loading ? (
              "Saving..."
            ) : isEditing ? (
              <>
                <IconCheck className="h-3.5 w-3.5" />
                Save Changes
              </>
            ) : (
              <>
                <IconBriefcase className="h-3.5 w-3.5" />
                Create Job
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );

  if (isSidebar) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="p-0 overflow-hidden flex flex-col w-full"
          style={{ maxWidth: liveSidebarWidth, width: "100%" }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group"
            onMouseDown={handleDragStart}
          >
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-brand/40 transition-colors" />
          </div>
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
