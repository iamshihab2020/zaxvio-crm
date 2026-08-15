"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { normalizePhone } from "@/lib/phone";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ScrollFadeArea } from "@/components/reusable/scroll-fade-area";
import { cn } from "@/lib/utils";
import {
  IconPencil,
  IconUser,
  IconFileText,
  IconAlertCircle,
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
import { ITEM_TYPE_LABELS } from "@/lib/constants/job-options";
import {
  CatalogItemPicker,
  type CatalogPickerItem,
} from "@/components/dashboard/catalog/catalog-item-picker";
import { CatalogPriceHint } from "@/components/dashboard/reusable/catalog-price-hint";
import { resolveLineItemDescription } from "@/lib/line-items";
import { QuickPriceInput } from "@/components/dashboard/reusable/quick-price-input";
import {
  CustomerPicker,
  type CustomerSelection,
} from "@/components/dashboard/customers/customer-picker";
import { createCustomer } from "@/actions/customers";
import { AssetPicker } from "@/components/dashboard/equipment/asset-picker";
import { toast } from "sonner";

export interface LineItemFormData {
  description: string;
  itemType: string;
  quantity: string;
  unitPrice: string;
  catalogItemId: string | null;
}

export interface QuoteFormData {
  customerId: string;
  equipmentId: string;
  issuedDate: string;
  expiryDate: string;
  taxRate: string;
  discountAmount: string;
  notes: string;
  lineItems: LineItemFormData[];
}

interface QuoteCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: QuoteFormData) => void;
  loading: boolean;
  defaultTaxRate?: string;
  /** Pre-fill customer when creating from customer detail page */
  defaultCustomer?: { id: string; firstName: string; lastName: string } | null;
}

function getDefaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

interface NewItemForm {
  description: string;
  itemType: string;
  quantity: string;
  unitPrice: string;
  catalogItemId: string | null;
  catalogItemLabel: string;
  /** The catalog list price, kept so the form can show what this line overrides. */
  catalogUnitPrice: string | null;
}

const emptyItemForm: NewItemForm = {
  description: "",
  itemType: "labor",
  quantity: "1",
  unitPrice: "",
  catalogItemId: null,
  catalogItemLabel: "",
  catalogUnitPrice: null,
};

const emptyForm: Omit<QuoteFormData, "lineItems"> = {
  customerId: "",
  equipmentId: "",
  issuedDate: new Date().toISOString().split("T")[0],
  expiryDate: getDefaultExpiry(),
  taxRate: "0",
  discountAmount: "0",
  notes: "",
};

export function QuoteCreateDialog({
  open,
  onOpenChange,
  onSave,
  loading,
  defaultTaxRate,
  defaultCustomer,
}: QuoteCreateDialogProps) {
  const [form, setForm] = useState(emptyForm);
  const [lineItems, setLineItems] = useState<LineItemFormData[]>([]);
  const [errors, setErrors] = useState<
    Partial<Record<keyof typeof emptyForm, string>>
  >({});
  const [customerSelection, setCustomerSelection] =
    useState<CustomerSelection | null>(null);
  const [taxEditable, setTaxEditable] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // New line item form
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState<NewItemForm>(emptyItemForm);
  /** A price typed into the quick-add field but never committed — flushed at submit. */
  const [pendingPrice, setPendingPrice] = useState("");

  useEffect(() => {
    const defaultTaxPct = defaultTaxRate
      ? (parseFloat(defaultTaxRate) * 100).toString()
      : "0";
    setForm({ ...emptyForm, expiryDate: getDefaultExpiry(), taxRate: defaultTaxPct });
    setLineItems([]);
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
    setErrors({});
    setTaxEditable(false);
    setCreatingCustomer(false);
    setShowAddItem(false);
    setItemForm(emptyItemForm);
    setPendingPrice("");
  }, [open, defaultTaxRate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Partial<Record<keyof typeof emptyForm, string>> = {};

    if (!customerSelection) {
      newErrors.customerId = "Customer is required";
    } else if (
      customerSelection.type === "new" &&
      (!customerSelection.firstName.trim() || !customerSelection.lastName.trim())
    ) {
      newErrors.customerId = "First name and last name are required";
    }

    const taxRateNum = parseFloat(form.taxRate || "0");
    if (isNaN(taxRateNum) || taxRateNum < 0 || taxRateNum > 100) {
      newErrors.taxRate = "Tax rate must be between 0 and 100";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    let customerId: string;

    if (customerSelection!.type === "new") {
      setCreatingCustomer(true);
      const phone = customerSelection!.type === "new" ? normalizePhone(customerSelection!.phone) : "";
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

    // Convert percentage to decimal
    const taxDecimal = taxRateNum / 100;

    // Flush a quick price typed but never committed, so it cannot be silently
    // dropped by pressing Save.
    const pending = pendingPrice.trim();
    const pendingNumber = Number(pending);
    const itemsToSave =
      pending !== "" && Number.isFinite(pendingNumber) && pendingNumber >= 0
        ? [
            ...lineItems,
            {
              description: resolveLineItemDescription({ itemType: "other" }),
              itemType: "other",
              quantity: "1",
              unitPrice: pendingNumber.toFixed(2),
              catalogItemId: null,
            },
          ]
        : lineItems;

    onSave({ ...form, customerId, taxRate: taxDecimal.toString(), lineItems: itemsToSave });
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
  }

  function handleAddItem() {
    if (!itemForm.unitPrice.trim()) return;
    setLineItems((prev) => [
      ...prev,
      {
        // Resolved with the same rule the API applies, so an unnamed line
        // reads the same here as it will after the save.
        description: resolveLineItemDescription({
          description: itemForm.description,
          catalogName: itemForm.catalogItemLabel,
          itemType: itemForm.itemType,
        }),
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
  const discount = parseFloat(form.discountAmount || "0");
  const total = subtotal + taxAmount - discount;

  const isBusy = loading || creatingCustomer;
  const { mode, setMode, sidebarWidth: prefWidth, setSidebarWidth: setPrefWidth } = useViewPreference("quotes");
  const isSidebar = mode === "sidebar";

  /* ── Resizable sidebar width ──────────────────────────────── */
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

  const header = (
    <div className="flex items-center justify-between px-6 pt-6 pb-2">
      <div>
        <h2 className="font-heading text-lg font-semibold">Create Quote</h2>
        <p className="text-sm text-muted-foreground font-body">
          Create a new estimate to send to your customer for approval.
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
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 min-h-0 flex-1"
    >
      <ScrollFadeArea className="flex-1">
        <div className={`flex gap-6 px-6 pb-3 ${isSidebar ? "flex-col" : "flex-col lg:flex-row"}`}>
              {/* Left column: Quote details */}
              <div className="flex-1 min-w-0 space-y-4">
                {/* Section 1: Customer */}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconUser className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wider font-body">
                    Customer
                  </span>
                </div>

                {/* Customer picker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-body text-muted-foreground">
                      Customer <span className="text-destructive">*</span>
                    </Label>
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
                  {errors.customerId && customerSelection?.type !== "new" && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <IconAlertCircle className="h-3 w-3 shrink-0" />
                      {errors.customerId}
                    </p>
                  )}
                </div>

                {/* Asset picker */}
                <div className="space-y-2">
                  <Label className="font-body text-muted-foreground">Equipment / Asset</Label>
                  <AssetPicker
                    customerId={
                      customerSelection?.type === "existing"
                        ? customerSelection.id
                        : null
                    }
                    value={form.equipmentId || null}
                    onChange={(id) =>
                      setForm((prev) => ({ ...prev, equipmentId: id ?? "" }))
                    }
                  />
                </div>

                {/* Separator */}
                <div className="border-t border-border" />

                {/* Section 2: Quote Details */}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconFileText className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wider font-body">
                    Quote Details
                  </span>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issuedDate" className="font-body text-muted-foreground">
                      Issued Date
                    </Label>
                    <DatePicker
                      id="issuedDate"
                      value={form.issuedDate}
                      onChange={(v) => updateField("issuedDate", v)}
                      placeholder="Issue date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate" className="font-body text-muted-foreground">
                      Valid Until
                    </Label>
                    <DatePicker
                      id="expiryDate"
                      value={form.expiryDate}
                      onChange={(v) => updateField("expiryDate", v)}
                      placeholder="Expiry date"
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
                    placeholder="Quote notes..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Right column: Line items */}
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

                <QuickPriceInput
                  label="Add a price"
                  value={pendingPrice}
                  onValueChange={setPendingPrice}
                  onAdd={(price) =>
                    setLineItems((prev) => [
                      ...prev,
                      {
                        description: resolveLineItemDescription({ itemType: "other" }),
                        itemType: "other",
                        quantity: "1",
                        unitPrice: price,
                        catalogItemId: null,
                      },
                    ])
                  }
                />

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
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(idx)}
                                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                              >
                                <IconTrash className="h-3 w-3" />
                              </Button>
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
                                catalogUnitPrice: item.unitPrice,
                                unitPrice: parseFloat(item.unitPrice).toFixed(2),
                                itemType: item.itemType,
                              }));
                            } else {
                              setItemForm((f) => ({
                                ...f,
                                catalogItemId: null,
                                catalogItemLabel: "",
                                catalogUnitPrice: null,
                              }));
                            }
                          }}
                        />
                      </div>
                      <Input
                        placeholder="Description (optional)"
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
                      <CatalogPriceHint
                        catalogPrice={itemForm.catalogUnitPrice}
                        currentPrice={itemForm.unitPrice}
                      />
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
                          disabled={!itemForm.unitPrice.trim()}
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
                    {discount > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground font-body">
                        <span>Discount</span>
                        <span>-${discount.toFixed(2)}</span>
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
              className="bg-brand text-brand-foreground hover:bg-brand/90 min-w-[160px] cursor-pointer"
              disabled={isBusy}
            >
              {creatingCustomer
                ? "Creating customer..."
                : loading
                  ? "Creating..."
                  : "Create Quote"}
            </Button>
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
          <SheetTitle className="sr-only">Create Quote</SheetTitle>
          <SheetDescription className="sr-only">Create a new quote.</SheetDescription>
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
