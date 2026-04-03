"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Customer } from "@hvac-saas/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomerTagsInput } from "./customer-tags-input";
import { updateCustomer, getCustomerTags, deleteCustomer } from "@/actions/customers";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import {
  IconChevronRight,
  IconPhone,
  IconMail,
  IconMapPin,
  IconCheck,
  IconPencil,
  IconBriefcase,
  IconFileDescription,
  IconReceipt,
  IconDots,
  IconTrash,
} from "@tabler/icons-react";

interface TagData {
  id: string;
  name: string;
  color: string | null;
}

interface CustomerDetailHeaderProps {
  customer: Customer;
  onUpdate: (customer: Customer) => void;
  onNewJob: () => void;
  onNewQuote: () => void;
  onNewInvoice: () => void;
}

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
      <span className="inline-flex items-center gap-1">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          className="h-7 text-sm w-36"
          placeholder={placeholder}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
          className="shrink-0 h-6 w-6 text-brand hover:text-brand/80"
        >
          <IconCheck className="h-3.5 w-3.5" />
        </Button>
      </span>
    );
  }

  if (!value) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setEditing(true)}
        className="text-muted-foreground/40 hover:text-brand italic text-sm h-auto p-0"
      >
        {placeholder}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => setEditing(true)}
      className={`group inline-flex items-center gap-1 hover:text-brand h-auto p-0 ${className ?? ""}`}
    >
      <span>{value}</span>
      <IconPencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
    </Button>
  );
}

function formatPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const match = digits.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  return phone;
}

export function CustomerDetailHeader({ customer, onUpdate, onNewJob, onNewQuote, onNewInvoice }: CustomerDetailHeaderProps) {
  const router = useRouter();
  const initials = `${customer.firstName?.[0] ?? ""}${customer.lastName?.[0] ?? ""}`.toUpperCase();

  const [tags, setTags] = useState<TagData[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteCustomer(customer.id);
    if (!res.error) router.push("/customers");
    setDeleting(false);
  }

  const phone = customer.phone ? formatPhone(customer.phone) : "";
  const hasAddress = customer.address || customer.city || customer.state || customer.zipCode;
  const addressParts = [
    customer.address,
    [customer.city, customer.state].filter(Boolean).join(", "),
    customer.zipCode,
  ].filter(Boolean);

  return (
    <>
      <div className="border-b border-border bg-card">
        {/* Top bar: breadcrumb + actions */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-3 pb-2">
          <nav className="flex items-center gap-1 text-sm font-body">
            <Link
              href="/customers"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Customers
            </Link>
            <IconChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground font-medium">
              {customer.firstName} {customer.lastName}
            </span>
          </nav>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              className="bg-brand text-brand-foreground hover:bg-brand/90 h-8 text-xs"
              onClick={onNewJob}
            >
              <IconBriefcase className="h-3.5 w-3.5 mr-1.5" />
              New Job
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={onNewQuote}
            >
              <IconFileDescription className="h-3.5 w-3.5 mr-1.5" />
              Quote
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={onNewInvoice}
            >
              <IconReceipt className="h-3.5 w-3.5 mr-1.5" />
              Invoice
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <IconDots className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <IconTrash className="h-4 w-4 mr-2" />
                  Delete Customer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Customer card strip */}
        <div className="px-4 sm:px-6 pb-4 pt-1">
          <div className="flex items-center gap-4">
            <Avatar className="h-11 w-11 shrink-0 ring-2 ring-brand/20 ring-offset-2 ring-offset-card">
              <AvatarFallback className="bg-brand/10 text-brand text-sm font-heading">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              {/* Name */}
              <h1 className="text-base font-heading font-bold text-foreground leading-tight">
                <EditableText value={customer.firstName} field="firstName" placeholder="First" onSave={handleFieldSave} />
                {" "}
                <EditableText value={customer.lastName} field="lastName" placeholder="Last" onSave={handleFieldSave} />
              </h1>

              {/* Contact details — compact inline chips */}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {(phone || !customer.phone) && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                    <IconPhone className="h-3 w-3" />
                    <EditableText value={phone} field="phone" placeholder="Add phone" onSave={handleFieldSave} className="text-foreground text-xs" />
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                  <IconMail className="h-3 w-3" />
                  <EditableText value={customer.email ?? ""} field="email" placeholder="Add email" onSave={handleFieldSave} className="text-foreground text-xs" />
                </span>
                {hasAddress && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                    <IconMapPin className="h-3 w-3" />
                    <span className="text-foreground text-xs">{addressParts.join(", ")}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Tags — right of contact info */}
            <div className="hidden sm:flex items-center shrink-0">
              {tagsLoading ? (
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-14 rounded-full" />
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

          {/* Tags — mobile (below contact info) */}
          <div className="sm:hidden mt-2 pl-15">
            {tagsLoading ? (
              <Skeleton className="h-5 w-20 rounded-full" />
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

      <DeleteConfirmDialog
        entityName="Customer"
        itemLabel={`${customer.firstName} ${customer.lastName}`}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        loading={deleting}
        description="All jobs, invoices, quotes, assets, and agreements for this customer will be permanently deleted."
      />
    </>
  );
}
