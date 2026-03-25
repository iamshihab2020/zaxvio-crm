"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconBuilding, IconSettings } from "@tabler/icons-react";
import { SettingsSection } from "@/components/dashboard/settings/settings-section";
import { SettingsFormMessage } from "@/components/dashboard/settings/settings-form-message";
import { updateTenant } from "@/actions/tenants";

interface BusinessFormProps {
  tenant: {
    businessName: string;
    ownerName: string;
    email: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    defaultTaxRate: string | null;
    googleReviewUrl: string | null;
  };
  onSaved?: (updated: Record<string, unknown>) => void;
}

export function BusinessForm({ tenant, onSaved }: BusinessFormProps) {
  const [form, setForm] = useState({
    businessName: tenant.businessName,
    ownerName: tenant.ownerName,
    email: tenant.email,
    phone: tenant.phone ?? "",
    address: tenant.address ?? "",
    city: tenant.city ?? "",
    state: tenant.state ?? "",
    zipCode: tenant.zipCode ?? "",
    defaultTaxRate: tenant.defaultTaxRate
      ? (parseFloat(tenant.defaultTaxRate) * 100).toString()
      : "0",
    googleReviewUrl: tenant.googleReviewUrl ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const initialTaxRate = tenant.defaultTaxRate
    ? (parseFloat(tenant.defaultTaxRate) * 100).toString()
    : "0";

  const hasChanges =
    form.businessName !== tenant.businessName ||
    form.ownerName !== tenant.ownerName ||
    form.email !== tenant.email ||
    form.phone !== (tenant.phone ?? "") ||
    form.address !== (tenant.address ?? "") ||
    form.city !== (tenant.city ?? "") ||
    form.state !== (tenant.state ?? "") ||
    form.zipCode !== (tenant.zipCode ?? "") ||
    form.defaultTaxRate !== initialTaxRate ||
    form.googleReviewUrl !== (tenant.googleReviewUrl ?? "");

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    // Validate tax rate
    const taxNum = parseFloat(form.defaultTaxRate || "0");
    if (isNaN(taxNum) || taxNum < 0 || taxNum > 100) {
      setMessage({
        type: "error",
        text: "Tax rate must be a number between 0 and 100.",
      });
      setSaving(false);
      return;
    }

    // Convert percentage to decimal for storage (e.g., 8.25 -> 0.0825)
    const taxDecimal = (taxNum / 100).toString();

    const result = await updateTenant({
      businessName: form.businessName,
      ownerName: form.ownerName,
      email: form.email,
      phone: form.phone || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      zipCode: form.zipCode || undefined,
      defaultTaxRate: taxDecimal,
      googleReviewUrl: form.googleReviewUrl || undefined,
    });

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Business settings saved." });
      if (result.data) {
        onSaved?.(result.data as Record<string, unknown>);
      }
    }

    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <SettingsSection
        icon={IconBuilding}
        title="Business Information"
        description="Your business details appear on invoices, quotes, and customer communications."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="businessName" className="font-body">
                Business Name
              </Label>
              <Input
                id="businessName"
                value={form.businessName}
                onChange={(e) => updateField("businessName", e.target.value)}
                placeholder="My HVAC Company"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerName" className="font-body">
                Owner Name
              </Label>
              <Input
                id="ownerName"
                value={form.ownerName}
                onChange={(e) => updateField("ownerName", e.target.value)}
                placeholder="John Smith"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bizEmail" className="font-body">
                Email
              </Label>
              <Input
                id="bizEmail"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="info@mycompany.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="font-body">
                Phone
              </Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="(555) 123-4567"
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
              placeholder="123 Main St"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city" className="font-body">
                City
              </Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="Houston"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state" className="font-body">
                State
              </Label>
              <Input
                id="state"
                value={form.state}
                onChange={(e) => updateField("state", e.target.value)}
                placeholder="TX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode" className="font-body">
                Zip Code
              </Label>
              <Input
                id="zipCode"
                value={form.zipCode}
                onChange={(e) => updateField("zipCode", e.target.value)}
                placeholder="77001"
              />
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={IconSettings}
        title="Defaults & Integrations"
        description="Configure default values and third-party integrations."
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="defaultTaxRate" className="font-body">
              Default Tax Rate (%)
            </Label>
            <Input
              id="defaultTaxRate"
              value={form.defaultTaxRate}
              onChange={(e) => updateField("defaultTaxRate", e.target.value)}
              placeholder="8.25"
            />
            <p className="text-xs text-muted-foreground">
              Applied automatically to new jobs. e.g. 8.25 for 8.25%
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="googleReviewUrl" className="font-body">
              Google Review URL
            </Label>
            <Input
              id="googleReviewUrl"
              value={form.googleReviewUrl}
              onChange={(e) =>
                updateField("googleReviewUrl", e.target.value)
              }
              placeholder="https://g.page/r/..."
            />
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
