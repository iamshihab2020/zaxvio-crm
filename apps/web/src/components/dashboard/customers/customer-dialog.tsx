"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
import { IconUser, IconMapPin, IconAlertCircle, IconNote, IconInfoCircle } from "@tabler/icons-react";
import { formatPhoneInput, normalizePhone } from "@/lib/phone";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { checkDuplicateCustomer } from "@/actions/customers";
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
  /** The `customers.notes` column — accepted by the API since day one and never
   *  editable anywhere, so nothing could ever be written to it (CUST-20). */
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

const MAX = {
  name: 120,
  email: 320,
  phone: 32,
  address: 300,
  city: 120,
  state: 120,
  zipCode: 32,
  notes: 5000,
} as const;

/** Mirrors the server's rule so the message arrives before the round trip. */
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
  const [duplicate, setDuplicate] = useState<{ id: string; firstName: string; lastName: string } | null>(null);

  const isEditing = !!customer;
  const debouncedEmail = useDebouncedValue(form.email, 500);

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
        notes: customer.notes ?? "",
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
    setDuplicate(null);
  }, [customer, open]);

  // Advisory duplicate check — a shared household email is legitimate, so this
  // warns rather than blocks. It matters because the public booking portal links
  // submissions to customers by email, and two rows with the same address make
  // that match ambiguous (CUST-28).
  useEffect(() => {
    if (!open) return;
    const email = debouncedEmail.trim();
    if (!email || !isValidEmail(email)) {
      setDuplicate(null);
      return;
    }
    let cancelled = false;
    checkDuplicateCustomer(email, customer?.id).then((res) => {
      if (!cancelled) setDuplicate(res.data?.duplicate ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedEmail, open, customer?.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Partial<Record<keyof CustomerFormData, string>> = {};
    if (!form.firstName.trim()) newErrors.firstName = "First name is required";
    if (!form.lastName.trim()) newErrors.lastName = "Last name is required";
    // The API accepted "nope" as an email until CUST-09; the browser only
    // enforces `type="email"`, which the inline header editor bypasses entirely.
    if (form.email.trim() && !isValidEmail(form.email.trim())) {
      newErrors.email = "Enter a valid email address";
    }
    if (form.phone.trim() && normalizePhone(form.phone).replace(/\D/g, "").length < 4) {
      newErrors.phone = "That doesn't look like a phone number";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Normalised, never truncated — the old helper dropped every digit past the
    // tenth, so an international number was silently corrupted on save (CUST-08).
    onSave({ ...form, phone: normalizePhone(form.phone) });
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
                  maxLength={MAX.name}
                  aria-invalid={!!errors.firstName}
                  aria-describedby={errors.firstName ? "firstName-error" : undefined}
                  className={errors.firstName ? "border-destructive" : ""}
                />
                {errors.firstName && (
                  <p id="firstName-error" className="flex items-center gap-1 text-xs text-destructive">
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
                  maxLength={MAX.name}
                  aria-invalid={!!errors.lastName}
                  aria-describedby={errors.lastName ? "lastName-error" : undefined}
                  className={errors.lastName ? "border-destructive" : ""}
                />
                {errors.lastName && (
                  <p id="lastName-error" className="flex items-center gap-1 text-xs text-destructive">
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
                  maxLength={MAX.email}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <p id="email-error" className="flex items-center gap-1 text-xs text-destructive">
                    <IconAlertCircle className="h-3 w-3 shrink-0" />
                    {errors.email}
                  </p>
                )}
                {!errors.email && duplicate && (
                  <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <IconInfoCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      {duplicate.firstName} {duplicate.lastName} already uses this email.{" "}
                      <Link
                        href={`/customers/${duplicate.id}`}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Open them instead
                      </Link>
                      ?
                    </span>
                  </p>
                )}
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
                  placeholder="(555) 123-4567 or +44 20 7946 0958"
                  maxLength={MAX.phone}
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  className={errors.phone ? "border-destructive" : ""}
                />
                {errors.phone && (
                  <p id="phone-error" className="flex items-center gap-1 text-xs text-destructive">
                    <IconAlertCircle className="h-3 w-3 shrink-0" />
                    {errors.phone}
                  </p>
                )}
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
                    maxLength={MAX.zipCode}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Section: Notes — the `customers.notes` column, finally reachable */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground font-heading">
              <IconNote className="h-4 w-4 text-muted-foreground" />
              Notes
            </div>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Gate code, preferred contact time, anything worth knowing before you arrive..."
              rows={3}
              maxLength={MAX.notes}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground font-body">
              Always visible on the customer&rsquo;s page. For dated, per-visit notes use the
              Notes tab instead.
            </p>
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
