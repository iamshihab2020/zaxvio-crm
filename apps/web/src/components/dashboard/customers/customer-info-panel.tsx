"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@hvac-saas/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { CustomerTagsInput } from "./customer-tags-input";
import { updateCustomer, getCustomerTags } from "@/actions/customers";
import {
  IconPhone,
  IconMail,
  IconMapPin,
  IconCheck,
  IconPencil,
  IconBriefcase,
  IconFileDescription,
  IconReceipt,
  IconPlus,
} from "@tabler/icons-react";

interface TagData {
  id: string;
  name: string;
  color: string | null;
}

interface CustomerInfoPanelProps {
  customer: Customer;
  onUpdate: (customer: Customer) => void;
}

/** Click-to-edit field that looks like plain text until hovered/clicked */
function EditableText({
  value,
  field,
  placeholder,
  onSave,
  className,
}: {
  value: string;
  field: string;
  placeholder: string;
  onSave: (field: string, value: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function handleSave() {
    setEditing(false);
    if (draft !== value) onSave(field, draft);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          className="h-7 text-sm"
          placeholder={placeholder}
        />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
          className="shrink-0 text-brand hover:text-brand/80"
        >
          <IconCheck className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`group flex items-center gap-1 text-left hover:text-brand transition-colors cursor-pointer ${className ?? ""}`}
    >
      <span className={value ? "text-foreground" : "text-muted-foreground/40"}>
        {value || placeholder}
      </span>
      <IconPencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
    </button>
  );
}

function formatPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const match = digits.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  return phone;
}

export function CustomerInfoPanel({ customer, onUpdate }: CustomerInfoPanelProps) {
  const router = useRouter();
  const [tags, setTags] = useState<TagData[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);

  useEffect(() => {
    getCustomerTags(customer.id).then((res) => {
      if (res.data) setTags(res.data);
      setTagsLoading(false);
    });
  }, [customer.id]);

  async function handleFieldSave(field: string, value: string) {
    const res = await updateCustomer(customer.id, { [field]: value });
    if (res.data) onUpdate(res.data);
  }

  const phone = customer.phone ? formatPhone(customer.phone) : "";
  const hasAddress = customer.address || customer.city || customer.state || customer.zipCode;
  const addressLine = [customer.city, customer.state].filter(Boolean).join(", ");
  const fullAddress = [
    customer.address,
    [addressLine, customer.zipCode].filter(Boolean).join(" "),
  ].filter(Boolean).join("\n");

  return (
    <div className="p-4 space-y-4">
      {/* Contact rows — icon-led, like a phone contact card */}
      <div className="space-y-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 font-heading mb-2">
          Details
        </h3>

        {/* Phone */}
        <div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors group">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 dark:bg-blue-500/20">
            <IconPhone className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground font-body">Phone</p>
            <EditableText
              value={phone}
              field="phone"
              placeholder="Add phone"
              onSave={handleFieldSave}
              className="text-sm font-medium font-body"
            />
          </div>
        </div>

        {/* Email */}
        <div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors group">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10 dark:bg-green-500/20">
            <IconMail className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground font-body">Email</p>
            <EditableText
              value={customer.email ?? ""}
              field="email"
              placeholder="Add email"
              onSave={handleFieldSave}
              className="text-sm font-medium font-body truncate"
            />
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors group">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 dark:bg-amber-500/20 mt-0.5">
            <IconMapPin className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground font-body">Address</p>
            {hasAddress ? (
              <div className="space-y-0.5">
                <EditableText
                  value={customer.address ?? ""}
                  field="address"
                  placeholder="Add street"
                  onSave={handleFieldSave}
                  className="text-sm font-medium font-body"
                />
                <div className="flex items-center gap-1 text-sm font-body">
                  <EditableText
                    value={customer.city ?? ""}
                    field="city"
                    placeholder="City"
                    onSave={handleFieldSave}
                    className="font-medium"
                  />
                  {customer.city && customer.state && (
                    <span className="text-muted-foreground">,</span>
                  )}
                  <EditableText
                    value={customer.state ?? ""}
                    field="state"
                    placeholder="ST"
                    onSave={handleFieldSave}
                    className="font-medium"
                  />
                  <EditableText
                    value={customer.zipCode ?? ""}
                    field="zipCode"
                    placeholder="ZIP"
                    onSave={handleFieldSave}
                    className="font-medium"
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  /* clicking will trigger the street field to open */
                }}
                className="text-sm text-muted-foreground/40 hover:text-brand transition-colors cursor-pointer font-body flex items-center gap-1"
              >
                <IconPlus className="h-3 w-3" />
                Add address
              </button>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Tags */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 font-heading">
          Tags
        </h3>
        {tagsLoading ? (
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-18" />
          </div>
        ) : (
          <CustomerTagsInput
            customerId={customer.id}
            assignedTags={tags}
            onTagsChange={setTags}
          />
        )}
      </div>

      <Separator />

      {/* Quick Actions */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 font-heading">
          Quick Actions
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="flex-col h-auto py-2.5 px-1 text-[10px] gap-1.5 font-body"
            onClick={() => router.push(`/jobs?newJob=true&customerId=${customer.id}`)}
          >
            <IconBriefcase className="h-4 w-4 text-brand" />
            Job
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-col h-auto py-2.5 px-1 text-[10px] gap-1.5 font-body"
            onClick={() => router.push(`/quotes?newQuote=true&customerId=${customer.id}`)}
          >
            <IconFileDescription className="h-4 w-4 text-brand" />
            Quote
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-col h-auto py-2.5 px-1 text-[10px] gap-1.5 font-body"
            onClick={() => router.push(`/invoices?newInvoice=true&customerId=${customer.id}`)}
          >
            <IconReceipt className="h-4 w-4 text-brand" />
            Invoice
          </Button>
        </div>
      </div>
    </div>
  );
}
