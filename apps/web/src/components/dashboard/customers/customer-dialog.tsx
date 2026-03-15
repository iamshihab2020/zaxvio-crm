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
import { Textarea } from "@/components/ui/textarea";
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
  notes: string;
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
  notes: "",
};

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
        phone: customer.phone ?? "",
        address: customer.address ?? "",
        city: customer.city ?? "",
        state: customer.state ?? "",
        zipCode: customer.zipCode ?? "",
        notes: customer.notes ?? "",
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

    onSave(form);
  }

  function updateField(field: keyof CustomerFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEditing ? "Edit Customer" : "Add Customer"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Update customer details." : "Add a new customer to your account."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="font-body">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
                placeholder="John"
              />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="font-body">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
                placeholder="Doe"
              />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="font-body">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="font-body">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address" className="font-body">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="123 Main St"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city" className="font-body">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="Houston"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state" className="font-body">State</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(e) => updateField("state", e.target.value)}
                placeholder="TX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode" className="font-body">ZIP Code</Label>
              <Input
                id="zipCode"
                value={form.zipCode}
                onChange={(e) => updateField("zipCode", e.target.value)}
                placeholder="77001"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes" className="font-body">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
            />
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
              className="bg-brand text-brand-foreground hover:bg-brand/90"
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
