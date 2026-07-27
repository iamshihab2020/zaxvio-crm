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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomerTagsInput } from "./customer-tags-input";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import {
  useCustomerTags,
  useCustomerSummary,
  useUpdateCustomer,
  useDeleteCustomer,
} from "@/hooks/queries";
import { formatPhoneDisplay, normalizePhone } from "@/lib/phone";
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
  IconAlertCircle,
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Inline editor for a single field.
 *
 * Two things changed here. It validates before it commits, because this control
 * is a plain text input — the dialog's `type="email"` gave it browser validation
 * and this never had any, so `hello` was a savable email address (CUST-09). And
 * it takes separate `value` (what to store) and `display` (what to show) props:
 * seeding the input with the *formatted* phone meant the formatted string was
 * what got saved, leaving two representations in one column (CUST-07).
 */
function EditableText({
  value,
  display,
  field,
  placeholder,
  onSave,
  validate,
  className,
  inputType = "text",
}: {
  value: string;
  display?: string;
  field: string;
  placeholder: string;
  onSave: (field: string, value: string) => void;
  validate?: (value: string) => string | null;
  className?: string;
  inputType?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function handleSave() {
    const problem = validate?.(draft) ?? null;
    if (problem) {
      setError(problem);
      return; // stay in edit mode — losing the text silently is the old bug
    }
    setError(null);
    setEditing(false);
    if (draft !== value) onSave(field, draft);
  }

  function cancel() {
    setDraft(value);
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1">
          <Input
            ref={inputRef}
            type={inputType}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); if (error) setError(null); }}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") cancel();
            }}
            aria-invalid={!!error}
            aria-label={placeholder}
            className={`h-7 w-36 text-sm ${error ? "border-destructive" : ""}`}
            placeholder={placeholder}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
            className="h-6 w-6 shrink-0 text-brand hover:text-brand/80"
            aria-label="Save"
          >
            <IconCheck className="h-3.5 w-3.5" />
          </Button>
        </span>
        {error && (
          <span className="flex items-center gap-1 text-[11px] text-destructive">
            <IconAlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </span>
        )}
      </span>
    );
  }

  const shown = display ?? value;

  if (!shown) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setEditing(true)}
        className="h-auto p-0 text-sm italic text-muted-foreground/40 hover:text-brand"
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
      className={`group inline-flex h-auto items-center gap-1 p-0 hover:text-brand ${className ?? ""}`}
    >
      <span>{shown}</span>
      <IconPencil className="h-2.5 w-2.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
    </Button>
  );
}

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(num) ? num : 0);
}

export function CustomerDetailHeader({
  customer,
  onUpdate,
  onNewJob,
  onNewQuote,
  onNewInvoice,
}: CustomerDetailHeaderProps) {
  const router = useRouter();
  const initials = `${customer.firstName?.[0] ?? ""}${customer.lastName?.[0] ?? ""}`.toUpperCase();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // All three of these used to be bare server-action calls whose failures were
  // discarded by an `if (res.data)` with no else (CUST-10). The hooks toast.
  const tagsQuery = useCustomerTags(customer.id);
  const summaryQuery = useCustomerSummary(customer.id);
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();

  const tags: TagData[] = tagsQuery.data?.data ?? [];
  const summary = summaryQuery.data?.data;

  function handleFieldSave(field: string, rawValue: string) {
    const value = field === "phone" ? normalizePhone(rawValue) : rawValue;
    updateMutation.mutate(
      { id: customer.id, data: { [field]: value } },
      {
        onSuccess: (res) => {
          if (!res.error && res.data) onUpdate(res.data);
        },
      },
    );
  }

  function handleDelete() {
    deleteMutation.mutate(customer.id, {
      onSuccess: (res) => {
        // A refused delete now says why instead of leaving the dialog open in
        // silence — the API's message names the blocking records.
        if (!res.error) {
          setDeleteOpen(false);
          router.push("/customers");
        }
      },
    });
  }

  function validateEmail(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return EMAIL_RE.test(trimmed) ? null : "Enter a valid email address";
  }

  function validatePhone(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return normalizePhone(trimmed).replace(/\D/g, "").length >= 4
      ? null
      : "That doesn't look like a phone number";
  }

  const addressLine = [
    customer.address,
    [customer.city, customer.state].filter(Boolean).join(", "),
    customer.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <div className="border-b border-border bg-card">
        {/* Top bar: breadcrumb + actions */}
        <div className="flex items-center justify-between px-4 pb-2 pt-3 sm:px-6">
          <nav className="flex items-center gap-1 font-body text-sm">
            <Link
              href="/customers"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Customers
            </Link>
            <IconChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {customer.firstName} {customer.lastName}
            </span>
          </nav>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-8 bg-brand text-xs text-brand-foreground hover:bg-brand/90"
              onClick={onNewJob}
            >
              <IconBriefcase className="mr-1.5 h-3.5 w-3.5" />
              New Job
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onNewQuote}>
              <IconFileDescription className="mr-1.5 h-3.5 w-3.5" />
              Quote
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onNewInvoice}>
              <IconReceipt className="mr-1.5 h-3.5 w-3.5" />
              Invoice
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <IconDots className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <IconTrash className="mr-2 h-4 w-4" />
                  Delete Customer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Customer card strip */}
        <div className="px-4 pb-4 pt-1 sm:px-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-11 w-11 shrink-0 ring-2 ring-brand/20 ring-offset-2 ring-offset-card">
              <AvatarFallback className="bg-brand/10 font-heading text-sm text-brand">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-base font-bold leading-tight text-foreground">
                <EditableText value={customer.firstName} field="firstName" placeholder="First" onSave={handleFieldSave} />
                {" "}
                <EditableText value={customer.lastName} field="lastName" placeholder="Last" onSave={handleFieldSave} />
              </h1>

              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                  <IconPhone className="h-3 w-3" />
                  {/*
                    `value` is the stored number; `display` is the pretty one.
                    Editing therefore starts from what is in the database, not
                    from "(555) 123-4567" (CUST-07).
                  */}
                  <EditableText
                    value={customer.phone ?? ""}
                    display={formatPhoneDisplay(customer.phone)}
                    field="phone"
                    placeholder="Add phone"
                    onSave={handleFieldSave}
                    validate={validatePhone}
                    inputType="tel"
                    className="text-xs text-foreground"
                  />
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                  <IconMail className="h-3 w-3" />
                  <EditableText
                    value={customer.email ?? ""}
                    field="email"
                    placeholder="Add email"
                    onSave={handleFieldSave}
                    validate={validateEmail}
                    inputType="email"
                    className="text-xs text-foreground"
                  />
                </span>
                {/* Address is editable here now. It was read-only while name,
                    phone and email were not — and a service address is the field
                    a dispatcher corrects most often (CUST report §5.5). */}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                  <IconMapPin className="h-3 w-3" />
                  <EditableText
                    value={customer.address ?? ""}
                    display={addressLine}
                    field="address"
                    placeholder="Add address"
                    onSave={handleFieldSave}
                    className="text-xs text-foreground"
                  />
                </span>
              </div>
            </div>

            {/* Tags */}
            <div className="hidden shrink-0 items-center sm:flex">
              {tagsQuery.isLoading ? (
                <Skeleton className="h-5 w-14 rounded-full" />
              ) : (
                <CustomerTagsInput customerId={customer.id} assignedTags={tags} />
              )}
            </div>
          </div>

          {/* Tags — mobile */}
          <div className="mt-2 sm:hidden">
            {tagsQuery.isLoading ? (
              <Skeleton className="h-5 w-20 rounded-full" />
            ) : (
              <CustomerTagsInput customerId={customer.id} assignedTags={tags} />
            )}
          </div>

          {/*
            The three numbers you want before picking up the phone. They were
            computed one tab deep, from a page of 20 invoices reduced in the
            browser; they are now exact and come from one SQL query (CUST-05).
          */}
          {summary && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-body text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{summary.totalJobs}</span> job
                {summary.totalJobs === 1 ? "" : "s"}
              </span>
              <span>
                <span
                  className={
                    Number(summary.outstandingAmount) > 0
                      ? "font-medium text-brand"
                      : "font-medium text-foreground"
                  }
                >
                  {formatCurrency(summary.outstandingAmount)}
                </span>{" "}
                outstanding
                {summary.openInvoices > 0 ? ` (${summary.openInvoices} open)` : ""}
              </span>
              <span>
                <span className="font-medium text-foreground">
                  {formatCurrency(summary.lifetimeValue)}
                </span>{" "}
                lifetime
              </span>
              {summary.lastJobDate && (
                <span>
                  Last job{" "}
                  <span className="font-medium text-foreground">
                    {new Date(`${summary.lastJobDate}T12:00:00`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmDialog
        entityName="Customer"
        itemLabel={`${customer.firstName} ${customer.lastName}`}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        // Was: "All jobs, invoices, quotes, assets, and agreements … will be
        // permanently deleted" — which the API refuses to do, and which
        // contradicted the differently-worded promise on the list page (CUST-18).
        description="Their notes, tags and activity history go with them. If they still have any jobs, invoices or quotes — archived ones included — the delete will be refused; archive the customer instead."
      />
    </>
  );
}
