"use client";

import type { Tenant } from "@hvac-saas/types";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IconFileInvoice } from "@tabler/icons-react";
import { SettingsSection } from "@/components/dashboard/settings/settings-section";
import { SettingsFormMessage } from "@/components/dashboard/settings/settings-form-message";
import { updateTenant } from "@/actions/tenants";

export interface InvoiceFormValues {
  licenseNumber: string;
  invoicePaymentTerms: string;
  invoicePaymentInstructions: string;
  invoiceTermsConditions: string;
  invoiceFooterMessage: string;
}

interface InvoiceFormProps {
  tenant: {
    licenseNumber: string | null;
    invoicePaymentTerms: string | null;
    invoicePaymentInstructions: string | null;
    invoiceTermsConditions: string | null;
    invoiceFooterMessage: string | null;
  };
  onFormChange?: (values: InvoiceFormValues) => void;
  /**
   * INV-32: this was `Record<string, unknown>`, which forced both callers to
   * write `as unknown as TenantData` — a double cast [[strict-rules]] §4 bans.
   * `Tenant` is inferred from the Drizzle schema, so it cannot drift.
   */
  onSaved?: (updated: Tenant) => void;
}

export function InvoiceForm({ tenant, onFormChange, onSaved }: InvoiceFormProps) {
  const [form, setForm] = useState<InvoiceFormValues>({
    licenseNumber: tenant.licenseNumber ?? "",
    invoicePaymentTerms: tenant.invoicePaymentTerms ?? "",
    invoicePaymentInstructions: tenant.invoicePaymentInstructions ?? "",
    invoiceTermsConditions: tenant.invoiceTermsConditions ?? "",
    invoiceFooterMessage: tenant.invoiceFooterMessage ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const hasChanges =
    form.licenseNumber !== (tenant.licenseNumber ?? "") ||
    form.invoicePaymentTerms !== (tenant.invoicePaymentTerms ?? "") ||
    form.invoicePaymentInstructions !== (tenant.invoicePaymentInstructions ?? "") ||
    form.invoiceTermsConditions !== (tenant.invoiceTermsConditions ?? "") ||
    form.invoiceFooterMessage !== (tenant.invoiceFooterMessage ?? "");

  function updateField(field: keyof InvoiceFormValues, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      return next;
    });
  }

  // Notify parent of form value changes for live preview
  useEffect(() => {
    onFormChange?.(form);
  }, [form, onFormChange]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const result = await updateTenant({
      licenseNumber: form.licenseNumber || undefined,
      invoicePaymentTerms: form.invoicePaymentTerms || undefined,
      invoicePaymentInstructions: form.invoicePaymentInstructions || undefined,
      invoiceTermsConditions: form.invoiceTermsConditions || undefined,
      invoiceFooterMessage: form.invoiceFooterMessage || undefined,
    });

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Invoice settings saved." });
      if (result.data) {
        onSaved?.(result.data as Tenant);
      }
    }

    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <SettingsSection
        icon={IconFileInvoice}
        title="Invoice Details"
        description="Customize what appears on your invoices. Leave a field empty to hide it from the PDF."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="licenseNumber" className="font-body">
                License Number
              </Label>
              <Input
                id="licenseNumber"
                value={form.licenseNumber}
                onChange={(e) => updateField("licenseNumber", e.target.value)}
                placeholder="TX-TACLA12345"
              />
              <p className="text-xs text-muted-foreground">
                Shown below your business info on invoices
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoicePaymentTerms" className="font-body">
                Payment Terms
              </Label>
              <Input
                id="invoicePaymentTerms"
                value={form.invoicePaymentTerms}
                onChange={(e) =>
                  updateField("invoicePaymentTerms", e.target.value)
                }
                placeholder="Net 30"
              />
              <p className="text-xs text-muted-foreground">
                Shown next to the due date on invoices
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoicePaymentInstructions" className="font-body">
              Payment Instructions
            </Label>
            <Textarea
              id="invoicePaymentInstructions"
              value={form.invoicePaymentInstructions}
              onChange={(e) =>
                updateField("invoicePaymentInstructions", e.target.value)
              }
              placeholder="Pay via Zelle to acme@hvac.com or mail check to 123 Main St, Austin, TX 78701"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Shown as a &quot;Payment Instructions&quot; section on invoices
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceTermsConditions" className="font-body">
              Terms & Conditions
            </Label>
            <Textarea
              id="invoiceTermsConditions"
              value={form.invoiceTermsConditions}
              onChange={(e) =>
                updateField("invoiceTermsConditions", e.target.value)
              }
              placeholder="Late payments incur a 1.5% monthly fee. All work guaranteed for 90 days."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Shown as a &quot;Terms & Conditions&quot; section on invoices
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceFooterMessage" className="font-body">
              Footer Message
            </Label>
            <Input
              id="invoiceFooterMessage"
              value={form.invoiceFooterMessage}
              onChange={(e) =>
                updateField("invoiceFooterMessage", e.target.value)
              }
              placeholder="Thank you for choosing ACME HVAC!"
            />
            <p className="text-xs text-muted-foreground">
              Custom footer text. Defaults to &quot;Thank you for your
              business!&quot; if empty.
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsFormMessage message={message} />

      <div className="flex justify-end">
        <Button
          type="submit"
          className="bg-brand text-brand-foreground hover:bg-brand/90"
          disabled={!hasChanges || saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
