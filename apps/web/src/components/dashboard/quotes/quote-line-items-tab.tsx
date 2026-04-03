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
  addQuoteLineItem,
  updateQuoteLineItem,
  deleteQuoteLineItem,
} from "@/actions/quotes";
import {
  CatalogItemPicker,
  type CatalogPickerItem,
} from "@/components/dashboard/catalog/catalog-item-picker";

interface LineItem {
  id: string;
  itemType: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string | null;
  catalogItemId: string | null;
  sortOrder: number | null;
}

interface QuoteLineItemsTabProps {
  quoteId: string;
  lineItems: LineItem[];
  isDraft: boolean;
  onUpdate: () => void;
}

interface AddForm {
  description: string;
  itemType: string;
  quantity: string;
  unitPrice: string;
  catalogItemId: string | null;
  catalogItemLabel: string;
}

const emptyForm: AddForm = {
  description: "",
  itemType: "labor",
  quantity: "1",
  unitPrice: "",
  catalogItemId: null,
  catalogItemLabel: "",
};

export function QuoteLineItemsTab({
  quoteId,
  lineItems,
  isDraft,
  onUpdate,
}: QuoteLineItemsTabProps) {
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
    if (!form.description.trim() || !form.unitPrice.trim()) {
      toast.error("Description and unit price are required");
      return;
    }
    setSaving(true);
    const result = await addQuoteLineItem(quoteId, {
      description: form.description,
      itemType: form.itemType,
      quantity: form.quantity,
      unitPrice: form.unitPrice,
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
      catalogItemId: li.catalogItemId,
      catalogItemLabel: li.catalogItemId ? li.description : "",
    });
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setSaving(true);
    const result = await updateQuoteLineItem(quoteId, editingId, {
      description: editForm.description,
      itemType: editForm.itemType,
      quantity: editForm.quantity,
      unitPrice: editForm.unitPrice,
      catalogItemId: editForm.catalogItemId,
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
    const result = await deleteQuoteLineItem(quoteId, lineItemId);
    if (result.error) {
      toast.error(result.error);
    } else {
      onUpdate();
    }
  }

  return (
    <div>
      {lineItems.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light mb-3">
            <IconPackage className="h-5 w-5 text-brand" />
          </div>
          <p className="text-sm font-medium text-foreground font-body">
            No line items yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Add items to build your estimate
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
                {isDraft && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li) =>
                editingId === li.id ? (
                  <tr key={li.id} className="border-b border-border">
                    <td colSpan={isDraft ? 5 : 4} className="px-2 py-2">
                      <div className="space-y-2">
                        <CatalogItemPicker
                          selectedId={editForm.catalogItemId}
                          selectedLabel={editForm.catalogItemLabel}
                          onSelect={(item: CatalogPickerItem | null) => {
                            if (item) {
                              setEditForm((f) => ({
                                ...f,
                                catalogItemId: item.id,
                                catalogItemLabel: item.name,
                                description: item.name,
                                unitPrice: parseFloat(item.unitPrice).toFixed(2),
                                itemType: item.itemType,
                              }));
                            } else {
                              setEditForm((f) => ({
                                ...f,
                                catalogItemId: null,
                                catalogItemLabel: "",
                              }));
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <Input
                            value={editForm.description}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                description: e.target.value,
                              }))
                            }
                            placeholder="Description"
                            className="h-8 text-sm flex-1"
                          />
                          <Input
                            value={editForm.quantity}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                quantity: e.target.value,
                              }))
                            }
                            placeholder="Qty"
                            className="h-8 text-sm w-16"
                          />
                          <Input
                            value={editForm.unitPrice}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                unitPrice: e.target.value,
                              }))
                            }
                            placeholder="Price"
                            className="h-8 text-sm w-24 text-right"
                          />
                        </div>
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            className="h-7 text-xs cursor-pointer"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="h-7 text-xs cursor-pointer"
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={li.id}
                    className="border-b border-border last:border-0"
                  >
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
                    <td className="px-3 py-2 text-right text-muted-foreground font-body">
                      ${parseFloat(li.unitPrice).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-foreground font-body">
                      ${parseFloat(li.total ?? "0").toFixed(2)}
                    </td>
                    {isDraft && (
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
                    )}
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
      {isDraft && showAdd && (
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
                    description: item.name,
                    unitPrice: parseFloat(item.unitPrice).toFixed(2),
                    itemType: item.itemType,
                  }));
                } else {
                  setForm((f) => ({
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
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
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
              onChange={(e) =>
                setForm((f) => ({ ...f, quantity: e.target.value }))
              }
              className="w-20 text-sm"
            />
            <Input
              placeholder="Unit price"
              value={form.unitPrice}
              onChange={(e) =>
                setForm((f) => ({ ...f, unitPrice: e.target.value }))
              }
              className="w-28 text-sm"
            />
          </div>
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

      {isDraft && !showAdd && (
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
