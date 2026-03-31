"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconBuilding, IconSettings, IconPhoto, IconTrash, IconUpload } from "@tabler/icons-react";
import { SettingsSection } from "@/components/dashboard/settings/settings-section";
import { SettingsFormMessage } from "@/components/dashboard/settings/settings-form-message";
import { updateTenant, uploadLogo, removeLogo } from "@/actions/tenants";

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
    logoUrl: string | null;
  };
  onSaved?: (updated: Record<string, unknown>) => void;
}

export function BusinessForm({ tenant, onSaved }: BusinessFormProps) {
  const [logoPreview, setLogoPreview] = useState<string | null>(tenant.logoUrl);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please select an image file." });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: "Logo must be under 2MB." });
      return;
    }

    setUploadingLogo(true);
    setMessage(null);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const result = await uploadLogo({
        base64,
        filename: file.name,
        mimeType: file.type,
      });

      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        const newUrl = (result.data as Record<string, unknown>)?.logoUrl as string;
        setLogoPreview(newUrl);
        setMessage({ type: "success", text: "Logo uploaded." });
        if (result.data) onSaved?.(result.data as Record<string, unknown>);
      }
      setUploadingLogo(false);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemoveLogo() {
    setRemovingLogo(true);
    setMessage(null);

    const result = await removeLogo();
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setLogoPreview(null);
      setMessage({ type: "success", text: "Logo removed." });
      if (result.data) onSaved?.(result.data as Record<string, unknown>);
    }
    setRemovingLogo(false);
  }

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
      {/* Logo Upload */}
      <SettingsSection
        icon={IconPhoto}
        title="Business Logo"
        description="Your logo appears on invoices, quotes, emails, and your booking page."
      >
        <div className="flex items-center gap-6">
          {/* Preview */}
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/50">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Business logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <IconPhoto className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                <IconUpload className="mr-1.5 h-3.5 w-3.5" />
                {uploadingLogo ? "Uploading..." : logoPreview ? "Change" : "Upload"}
              </Button>
              {logoPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLogo}
                  disabled={removingLogo}
                  className="text-destructive hover:text-destructive"
                >
                  <IconTrash className="mr-1.5 h-3.5 w-3.5" />
                  {removingLogo ? "Removing..." : "Remove"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, or SVG. Max 2MB. Square logos work best.
            </p>
          </div>
        </div>
      </SettingsSection>

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
