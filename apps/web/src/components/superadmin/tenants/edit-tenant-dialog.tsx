"use client";

import { useState } from "react";
import { IconEdit } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { editTenant } from "@/actions/admin";

interface TenantFields {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

export function EditTenantDialog({
  tenantId,
  initialValues,
  open,
  onOpenChange,
  onSuccess,
}: {
  tenantId: string;
  initialValues: Partial<TenantFields>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [fields, setFields] = useState<TenantFields>({
    businessName: initialValues.businessName ?? "",
    ownerName: initialValues.ownerName ?? "",
    email: initialValues.email ?? "",
    phone: initialValues.phone ?? "",
    slug: initialValues.slug ?? "",
    address: initialValues.address ?? "",
    city: initialValues.city ?? "",
    state: initialValues.state ?? "",
    zipCode: initialValues.zipCode ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (key: keyof TenantFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    const result = await editTenant(tenantId, { ...fields });
    setLoading(false);
    if (result.success) {
      onOpenChange(false);
      onSuccess();
    } else {
      setError(result.error ?? "Failed to update tenant");
    }
  };

  const formFields: { key: keyof TenantFields; label: string; colSpan?: number }[] = [
    { key: "businessName", label: "Business Name" },
    { key: "ownerName", label: "Owner Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "slug", label: "Slug" },
    { key: "address", label: "Address", colSpan: 2 },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "zipCode", label: "Zip Code" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <IconEdit className="h-5 w-5 text-admin-accent" />
            Edit Tenant
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {formFields.map((field) => (
            <div
              key={field.key}
              className={`space-y-2 ${field.colSpan === 2 ? "sm:col-span-2" : ""}`}
            >
              <Label htmlFor={field.key} className="font-body text-sm">
                {field.label}
              </Label>
              <Input
                id={field.key}
                value={fields[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="font-body"
              />
            </div>
          ))}
        </div>
        {error && (
          <p className="text-sm text-destructive font-body">{error}</p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-admin-accent hover:bg-admin-accent/90 text-white"
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
