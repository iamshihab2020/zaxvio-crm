"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconPlus,
  IconDots,
  IconEdit,
  IconTrash,
  IconPackage,
  IconLink,
} from "@tabler/icons-react";
import { ITEM_TYPE_LABELS } from "@/lib/constants/job-options";
import {
  addJobLineItem,
  updateJobLineItem,
  removeJobLineItem,
} from "@/actions/jobs";
import {
  CatalogItemPicker,
  type CatalogPickerItem,
} from "@/components/dashboard/catalog/catalog-item-picker";
import { QuickPriceInput } from "@/components/dashboard/reusable/quick-price-input";
import { CatalogPriceHint } from "@/components/dashboard/reusable/catalog-price-hint";

interface LineItem {
  id: string;
  itemType: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unitCost: string | null;
  total: string | null;
  catalogItemId: string | null;
  sortOrder: number | null;
}

interface JobDetailLineItemsProps {
  jobId: string;
  lineItems: LineItem[];
  onUpdate: () => void;
}

interface AddForm {
  description: string;
  itemType: string;
  quantity: string;
  unitPrice: string;
  /** Blank means "not costed", which is not the same as costing nothing. */
  unitCost: string;
  catalogItemId: string | null;
  catalogItemLabel: string;
  /** The catalog list price, kept so the form can show what this line overrides. */
  catalogUnitPrice: string | null;
}

const emptyForm: AddForm = {
  description: "",
  itemType: "labor",
  quantity: "1",
  unitPrice: "",
  unitCost: "",
  catalogItemId: null,
  catalogItemLabel: "",
  catalogUnitPrice: null,
};

export function JobDetailLineItems({
  jobId,
  lineItems,
  onUpdate,
}: JobDetailLineItemsProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AddForm>(emptyForm);

  const subtotal = lineItems.reduce(
    (sum, li) => sum + parseFloat(li.total ?? "0"),
    0,
  );

  async function handleAdd() {
    if (!form.unitPrice.trim()) {
      toast.error("A price is required");
      return;
    }
    const qty = parseFloat(form.quantity);
    const price = parseFloat(form.unitPrice);
    if (isNaN(qty) || qty <= 0) { toast.error("Quantity must be a positive number"); return; }
    if (isNaN(price) || price < 0) { toast.error("Unit price must be a valid number"); return; }
    if (form.unitCost.trim() && isNaN(parseFloat(form.unitCost))) {
      toast.error("Unit cost must be a valid number");
      return;
    }
    setSaving(true);
    const result = await addJobLineItem(jobId, {
      description: form.description,
      itemType: form.itemType,
      quantity: form.quantity,
      unitPrice: form.unitPrice,
      // Omitted rather than sent as null when blank, so an untouched field
      // never overwrites a cost the catalog auto-filled on the server.
      ...(form.unitCost.trim() ? { unitCost: form.unitCost.trim() } : {}),
      ...(form.catalogItemId ? { catalogItemId: form.catalogItemId } : {}),
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      setForm(emptyForm);
      setShowAdd(false);
      onUpdate();
    }
  }

  function startEdit(li: LineItem) {
    setEditingId(li.id);
    setEditForm({
      description: li.description,
      itemType: li.itemType,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      unitCost: li.unitCost ?? "",
      catalogItemId: li.catalogItemId,
      catalogItemLabel: "",
      catalogUnitPrice: null,
    });
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const qty = parseFloat(editForm.quantity);
    const price = parseFloat(editForm.unitPrice);
    if (isNaN(qty) || qty <= 0) { toast.error("Quantity must be a positive number"); return; }
    if (isNaN(price) || price < 0) { toast.error("Unit price must be a valid number"); return; }
    setSaving(true);
    const result = await updateJobLineItem(jobId, editingId, {
      description: editForm.description,
      itemType: editForm.itemType,
      quantity: editForm.quantity,
      unitPrice: editForm.unitPrice,
      // Explicit null on an emptied field: clearing a cost has to be
      // expressible, or a line item can be costed but never un-costed.
      unitCost: editForm.unitCost.trim() ? editForm.unitCost.trim() : null,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      setEditingId(null);
      onUpdate();
    }
  }

  async function handleDelete(lineItemId: string) {
    if (!window.confirm("Delete this line item?")) return;
    const result = await removeJobLineItem(jobId, lineItemId);
    if (result.error) {
      toast.error(result.error);
    } else {
      onUpdate();
    }
  }

  /**
   * A price with nothing else to say — a lead logged at $500, a call-out at $85.
   * It still creates a line item, so there is one money model rather than a
   * flat amount sitting beside a summed subtotal; the API names the line from
   * its item type, and the row stays fully editable.
   */
  async function handleQuickPrice(price: string) {
    const result = await addJobLineItem(jobId, {
      itemType: "other",
      quantity: "1",
      unitPrice: price,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      onUpdate();
    }
  }

  return (
    <div>
      <QuickPriceInput onAdd={handleQuickPrice} className="mb-3" />

      {lineItems.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-8 text-center">
          <IconPackage className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground font-body">
            No line items yet
          </p>
        </div>
      )}

      {lineItems.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
                  Description
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body w-16">
                  Qty
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground font-body w-20">
                  Price
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground font-body w-20">
                  Total
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li) =>
                editingId === li.id ? (
                  <tr key={li.id} className="border-b border-border">
                    <td className="px-2 py-1.5">
                      <Input
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={editForm.quantity}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            quantity: e.target.value,
                          }))
                        }
                        className="h-8 text-sm w-16"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={editForm.unitPrice}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            unitPrice: e.target.value,
                          }))
                        }
                        className="h-8 text-sm w-20 text-right tnum"
                        aria-label="Unit price"
                      />
                      <Input
                        value={editForm.unitCost}
                        placeholder="cost"
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            unitCost: e.target.value,
                          }))
                        }
                        className="mt-1 h-7 text-xs w-20 text-right tnum"
                        aria-label="Unit cost"
                      />
                    </td>
                    <td />
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={saving}
                          className="h-7 text-xs cursor-pointer"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          className="h-7 text-xs cursor-pointer"
                        >
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={li.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-body">
                      <div className="flex items-center gap-1.5 text-foreground">
                        {li.description}
                        {li.catalogItemId && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <IconLink className="h-2.5 w-2.5" />
                            Catalog
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ITEM_TYPE_LABELS[li.itemType] ?? li.itemType}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground font-body">
                      {li.quantity}
                    </td>
                    {/* Cost sits under the price rather than in a fifth column:
                        it is only ever read *against* the price, and the sheet
                        has no room for another money column. "No cost" is
                        stated rather than left blank — a blank cell reads as
                        zero, and zero cost reads as pure profit. */}
                    <td className="px-3 py-2 text-right font-body">
                      <div className="text-muted-foreground">
                        ${parseFloat(li.unitPrice).toFixed(2)}
                      </div>
                      {li.unitCost ? (
                        <div className="tnum font-mono text-[11px] text-muted-foreground">
                          cost ${parseFloat(li.unitCost).toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground/70">
                          no cost
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-foreground font-body">
                      ${parseFloat(li.total ?? "0").toFixed(2)}
                    </td>
                    <td className="px-2 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <IconDots className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => startEdit(li)}
                            className="cursor-pointer"
                          >
                            <IconEdit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(li.id)}
                            className="cursor-pointer text-destructive focus:text-destructive"
                          >
                            <IconTrash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>

          <div className="flex justify-between px-3 py-2 bg-muted/30 border-t border-border">
            <span className="text-sm font-medium text-muted-foreground font-body">
              Subtotal
            </span>
            <span className="text-sm font-semibold text-foreground font-body">
              ${subtotal.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Add line item form */}
      {showAdd && (
        <div className="mt-3 rounded-md border border-border p-3 space-y-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              From catalog (optional)
            </label>
            <CatalogItemPicker
              selectedId={form.catalogItemId}
              selectedLabel={form.catalogItemLabel}
              onSelect={(item: CatalogPickerItem | null) => {
                if (item) {
                  setForm((f) => ({
                    ...f,
                    catalogItemId: item.id,
                    catalogItemLabel: item.name,
                    catalogUnitPrice: item.unitPrice,
                    unitPrice: parseFloat(item.unitPrice).toFixed(2),
                    // Prefilled from the catalog so the common case needs no
                    // typing, and still editable — a supplier price that moved
                    // this week belongs on this job, not on the catalog record.
                    unitCost: item.unitCost
                      ? parseFloat(item.unitCost).toFixed(2)
                      : "",
                    itemType: item.itemType,
                  }));
                } else {
                  setForm((f) => ({
                    ...f,
                    catalogItemId: null,
                    catalogItemLabel: "",
                    catalogUnitPrice: null,
                    unitCost: "",
                  }));
                }
              }}
            />
          </div>
          <Input
            placeholder={form.catalogItemLabel || "Description — optional, defaults to the item type"}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Select value={form.itemType} onValueChange={(v) => setForm((f) => ({ ...f, itemType: v }))}>
              <SelectTrigger className="h-9 text-sm font-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ITEM_TYPE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val} className="text-sm font-body">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Qty"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className="w-20 text-sm"
            />
            <Input
              placeholder="Unit price"
              value={form.unitPrice}
              onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
              className="w-28 text-sm tnum"
            />
            <Input
              placeholder="Your cost"
              value={form.unitCost}
              onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
              className="w-28 text-sm tnum"
              aria-label="Your cost per unit"
            />
          </div>
          <CatalogPriceHint
            catalogPrice={form.catalogUnitPrice}
            currentPrice={form.unitPrice}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAdd(false);
                setForm(emptyForm);
              }}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={saving}
              className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
            >
              {saving ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>
      )}

      {!showAdd && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(true)}
          className="mt-3 cursor-pointer"
        >
          <IconPlus className="mr-1.5 h-3.5 w-3.5" />
          Add Line Item
        </Button>
      )}
    </div>
  );
}
