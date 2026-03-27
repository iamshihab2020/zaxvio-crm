"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { IconArrowLeft, IconUserPlus } from "@tabler/icons-react";

export interface CustomerInfo {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  description: string;
}

interface BookingStepInfoProps {
  info: CustomerInfo;
  onChange: (info: CustomerInfo) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}

export function BookingStepInfo({
  info,
  onChange,
  onSubmit,
  onBack,
  submitting,
  error,
}: BookingStepInfoProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const update = (field: keyof CustomerInfo, value: string) => {
    onChange({ ...info, [field]: value });
  };

  const nameError = touched.customerName && info.customerName.trim().length < 2;
  const phoneError = touched.customerPhone && !info.customerPhone.trim();
  const canSubmit = info.customerName.trim().length >= 2 && info.customerPhone.trim();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
          <IconUserPlus className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h2 className="text-lg font-semibold font-heading text-foreground">
            Your information
          </h2>
          <p className="text-sm text-muted-foreground font-body">
            We need a few details to confirm your booking
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="font-body text-sm">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={info.customerName}
              onChange={(e) => update("customerName", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, customerName: true }))}
              placeholder="John Smith"
            />
            {nameError && (
              <p className="text-xs text-destructive">Name is required (min 2 characters)</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="font-body text-sm">
              Phone <span className="text-destructive">*</span>
            </Label>
            <Input
              type="tel"
              value={info.customerPhone}
              onChange={(e) => update("customerPhone", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, customerPhone: true }))}
              placeholder="(555) 123-4567"
            />
            {phoneError && <p className="text-xs text-destructive">Phone is required</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-body text-sm">Email</Label>
          <Input
            type="email"
            value={info.customerEmail}
            onChange={(e) => update("customerEmail", e.target.value)}
            placeholder="john@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label className="font-body text-sm">Service Address</Label>
          <Input
            value={info.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="123 Main St, Dallas TX"
          />
        </div>

        <div className="space-y-2">
          <Label className="font-body text-sm">Describe the issue (optional)</Label>
          <Textarea
            value={info.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="AC not cooling, making a rattling noise..."
            rows={3}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive font-body">
            {error}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="cursor-pointer">
          <IconArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="bg-brand text-brand-foreground hover:bg-brand/90 px-8 cursor-pointer"
        >
          {submitting ? "Booking..." : "Book Appointment"}
        </Button>
      </div>
    </div>
  );
}
