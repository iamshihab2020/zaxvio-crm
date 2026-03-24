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
import { Label } from "@/components/ui/label";
import { IconUser, IconMapPin, IconAlertCircle } from "@tabler/icons-react";
import type { Customer } from "@hvac-saas/types";

interface CustomerDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CustomerFormData) => void;
  loading: boolean;
}

export interface CustomerFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

const emptyForm: CustomerFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
};

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function stripPhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function CustomerDialog({
  customer,
  open,
  onOpenChange,
  onSave,
  loading,
}: CustomerDialogProps) {
  const [form, setForm] = useState<CustomerFormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerFormData, string>>>({});

  const isEditing = !!customer;

  useEffect(() => {
    if (customer) {
      setForm({
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email ?? "",
        phone: customer.phone ? formatPhoneInput(customer.phone) : "",
        address: customer.address ?? "",
        city: customer.city ?? "",
        state: customer.state ?? "",
        zipCode: customer.zipCode ?? "",
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [customer, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Partial<Record<keyof CustomerFormData, string>> = {};
    if (!form.firstName.trim()) newErrors.firstName = "First name is required";
    if (!form.lastName.trim()) newErrors.lastName = "Last name is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({ ...form, phone: stripPhone(form.phone) });
  }

  function updateField(field: keyof CustomerFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handlePhoneChange(value: string) {
    updateField("phone", formatPhoneInput(value));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEditing ? "Edit Customer" : "Add Customer"}
          </DialogTitle>
          <DialogDescription className="font-body">
            {isEditing
              ? "Update customer details."
              : "Add a new customer so you can schedule jobs and send invoices."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section: Contact Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground font-heading">
              <IconUser className="h-4 w-4 text-muted-foreground" />
              Contact Info
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="font-body text-muted-foreground">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                  placeholder="e.g. Mike"
                  className={errors.firstName ? "border-destructive" : ""}
                />
                {errors.firstName && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <IconAlertCircle className="h-3 w-3 shrink-0" />
                    {errors.firstName}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="font-body text-muted-foreground">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  placeholder="e.g. Johnson"
                  className={errors.lastName ? "border-destructive" : ""}
                />
                {errors.lastName && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <IconAlertCircle className="h-3 w-3 shrink-0" />
                    {errors.lastName}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-body text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="e.g. mike@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="font-body text-muted-foreground">
                  Phone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="(555) 123-4567"
                  maxLength={14}
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Section: Service Address */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground font-heading">
              <IconMapPin className="h-4 w-4 text-muted-foreground" />
              Service Address
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address" className="font-body text-muted-foreground">
                  Street Address
                </Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="e.g. 4521 Oak Creek Dr"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city" className="font-body text-muted-foreground">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder="e.g. Houston"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="font-body text-muted-foreground">
                    State
                  </Label>
                  <Input
                    id="state"
                    value={form.state}
                    onChange={(e) => updateField("state", e.target.value)}
                    placeholder="e.g. TX"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode" className="font-body text-muted-foreground">
                    ZIP Code
                  </Label>
                  <Input
                    id="zipCode"
                    value={form.zipCode}
                    onChange={(e) => updateField("zipCode", e.target.value)}
                    placeholder="e.g. 77001"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
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
              className="min-w-[140px] bg-brand text-brand-foreground hover:bg-brand/90"
              disabled={loading}
            >
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Add Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
