"use client";

import { useState, useEffect, useRef } from "react";
import type { Customer } from "@hvac-saas/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerTagsInput } from "./customer-tags-input";
import { updateCustomer, getCustomerTags } from "@/actions/customers";
import {
  IconUser,
  IconPhone,
  IconMail,
  IconMapPin,
  IconCheck,
  IconPencil,
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

interface EditableFieldProps {
  label: string;
  value: string;
  field: string;
  icon?: React.ReactNode;
  onSave: (field: string, value: string) => void;
}

function EditableField({ label, value, field, icon, onSave }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  function handleSave() {
    setEditing(false);
    if (draft !== value) {
      onSave(field, draft);
    }
  }

  if (editing) {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-body">{label}</Label>
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setDraft(value);
                setEditing(false);
              }
            }}
            className="h-7 text-sm"
          />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="shrink-0 text-brand hover:text-brand/80"
          >
            <IconCheck className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground font-body">{label}</Label>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-left hover:bg-muted transition-colors"
      >
        {icon}
        <span className={value ? "text-foreground flex-1" : "text-muted-foreground italic flex-1"}>
          {value || `Click to add ${label.toLowerCase()}`}
        </span>
        <IconPencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
      </button>
    </div>
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
    if (res.data) {
      onUpdate(res.data);
    }
  }

  const initials = `${customer.firstName?.[0] ?? ""}${customer.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Avatar + Name — warm header */}
      <div className="flex flex-col items-center gap-3 rounded-lg bg-brand-light/50 py-5 -mx-4 sm:-mx-5 -mt-4 sm:-mt-5 rounded-b-none px-4 sm:px-5">
        <Avatar className="h-16 w-16 ring-2 ring-brand/20 ring-offset-2 ring-offset-card">
          <AvatarFallback className="bg-brand/10 text-brand text-lg font-heading">
            {initials}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-lg font-heading font-semibold text-foreground">
          {customer.firstName} {customer.lastName}
        </h2>
      </div>

      {/* Contact Info */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
          Contact
        </h3>
        <div className="rounded-md bg-muted/50 p-3 space-y-2.5">
          <EditableField
            label="First Name"
            value={customer.firstName}
            field="firstName"
            icon={<IconUser className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            onSave={handleFieldSave}
          />
          <EditableField
            label="Last Name"
            value={customer.lastName}
            field="lastName"
            icon={<IconUser className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            onSave={handleFieldSave}
          />
          <EditableField
            label="Phone"
            value={customer.phone ? formatPhone(customer.phone) : ""}
            field="phone"
            icon={<IconPhone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            onSave={handleFieldSave}
          />
          <EditableField
            label="Email"
            value={customer.email ?? ""}
            field="email"
            icon={<IconMail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            onSave={handleFieldSave}
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
          Address
        </h3>
        <div className="rounded-md bg-muted/50 p-3 space-y-2.5">
          <EditableField
            label="Street"
            value={customer.address ?? ""}
            field="address"
            icon={<IconMapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            onSave={handleFieldSave}
          />
          <div className="grid grid-cols-3 gap-2">
            <EditableField
              label="City"
              value={customer.city ?? ""}
              field="city"
              onSave={handleFieldSave}
            />
            <EditableField
              label="State"
              value={customer.state ?? ""}
              field="state"
              onSave={handleFieldSave}
            />
            <EditableField
              label="ZIP"
              value={customer.zipCode ?? ""}
              field="zipCode"
              onSave={handleFieldSave}
            />
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
          Tags
        </h3>
        <div className="rounded-md bg-muted/50 p-3">
          {tagsLoading ? (
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ) : (
            <CustomerTagsInput
              customerId={customer.id}
              assignedTags={tags}
              onTagsChange={setTags}
            />
          )}
        </div>
      </div>
    </div>
  );
}
