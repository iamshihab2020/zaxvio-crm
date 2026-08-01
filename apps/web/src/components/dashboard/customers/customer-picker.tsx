"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  IconSearch,
  IconCheck,
  IconSelector,
  IconPlus,
  IconArrowBack,
  IconAlertCircle,
} from "@tabler/icons-react";
import { getCustomers } from "@/actions/customers";
import { formatPhoneInput } from "@/lib/phone";

export type CustomerSelection =
  | {
      type: "existing";
      id: string;
      firstName: string;
      lastName: string;
      address: string | null;
      city: string | null;
      state: string | null;
      zipCode: string | null;
    }
  | {
      type: "new";
      firstName: string;
      lastName: string;
      phone: string;
      email: string;
    };

interface CustomerPickerProps {
  value: CustomerSelection | null;
  onChange: (value: CustomerSelection | null) => void;
  error?: string;
}

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
}

export function CustomerPicker({ value, onChange, error }: CustomerPickerProps) {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const isNewMode = value?.type === "new";

  const fetchCustomers = useCallback(async (q: string) => {
    const result = await getCustomers({ search: q, limit: 10 });
    if (result.data) {
      setCustomers(
        result.data.map((c: CustomerOption) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          address: c.address ?? null,
          city: c.city ?? null,
          state: c.state ?? null,
          zipCode: c.zipCode ?? null,
        })),
      );
    }
  }, []);

  // Fetch customers when popover opens (lazy — not on every mount)
  useEffect(() => {
    if (!popoverOpen) return;
    fetchCustomers("");
  }, [popoverOpen, fetchCustomers]);

  // Refetch when user searches inside the popover
  useEffect(() => {
    if (!popoverOpen || search === "") return;
    const timer = setTimeout(() => fetchCustomers(search), 300);
    return () => clearTimeout(timer);
  }, [search, popoverOpen, fetchCustomers]);

  function handleSelect(customer: CustomerOption) {
    onChange({
      type: "existing",
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zipCode: customer.zipCode,
    });
    setPopoverOpen(false);
    setSearch("");
  }

  function handleNewCustomer() {
    setPopoverOpen(false);
    onChange({ type: "new", firstName: "", lastName: "", phone: "", email: "" });
  }

  function handleSwitchToExisting() {
    onChange(null);
  }

  function updateNewField(field: "firstName" | "lastName" | "phone" | "email", val: string) {
    if (value?.type !== "new") return;
    onChange({ ...value, [field]: val });
  }

  const selectedId = value?.type === "existing" ? value.id : null;
  const selectedLabel =
    value?.type === "existing"
      ? `${value.firstName} ${value.lastName}`
      : null;

  return (
    <div>
      {/* Popover trigger — collapses when in new-customer mode */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
        style={{ gridTemplateRows: isNewMode ? "0fr" : "1fr", opacity: isNewMode ? 0 : 1 }}
      >
        <div className="overflow-hidden">
          <Popover modal open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                tabIndex={isNewMode ? -1 : 0}
                className={cn(
                  "h-9 w-full justify-between font-body",
                  error && !isNewMode ? "border-destructive" : "",
                  !selectedLabel && "text-muted-foreground",
                )}
              >
                {selectedLabel || "Select customer..."}
                <IconSelector className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[calc(100vw-4rem)] sm:w-[340px] p-0"
              align="start"
            >
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <IconSearch className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search customers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8"
                  />
                </div>
              </div>
              <div className="max-h-[200px] overflow-y-auto p-1">
                {customers.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No customers found
                  </p>
                )}
                {customers.map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelect(c)}
                    className="w-full justify-start gap-2 font-body"
                  >
                    {selectedId === c.id && (
                      <IconCheck className="h-4 w-4 text-brand shrink-0" />
                    )}
                    <span className={cn(selectedId !== c.id && "pl-6")}>
                      {c.firstName} {c.lastName}
                    </span>
                  </Button>
                ))}
              </div>
              <div className="border-t border-border p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleNewCustomer}
                  className="w-full justify-start gap-2 font-body text-brand"
                >
                  <IconPlus className="h-4 w-4 shrink-0" />
                  New Customer
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Inline new customer form — expands when in new-customer mode */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
        style={{ gridTemplateRows: isNewMode ? "1fr" : "0fr", opacity: isNewMode ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground font-heading">
                New Customer
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSwitchToExisting}
                tabIndex={isNewMode ? 0 : -1}
                className="gap-1 text-xs text-brand hover:underline font-body h-auto p-0"
              >
                <IconArrowBack className="h-3 w-3" />
                Select existing
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-body text-muted-foreground">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={isNewMode ? value.firstName : ""}
                  onChange={(e) => updateNewField("firstName", e.target.value)}
                  placeholder="John"
                  className="h-8 text-sm"
                  tabIndex={isNewMode ? 0 : -1}
                />
                {error && isNewMode && !value.firstName.trim() && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <IconAlertCircle className="h-3 w-3 shrink-0" />
                    Required
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-body text-muted-foreground">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={isNewMode ? value.lastName : ""}
                  onChange={(e) => updateNewField("lastName", e.target.value)}
                  placeholder="Doe"
                  className="h-8 text-sm"
                  tabIndex={isNewMode ? 0 : -1}
                />
                {error && isNewMode && !value.lastName.trim() && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <IconAlertCircle className="h-3 w-3 shrink-0" />
                    Required
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-body text-muted-foreground">
                  Phone
                </Label>
                <Input
                  value={isNewMode ? value.phone : ""}
                  onChange={(e) => updateNewField("phone", formatPhoneInput(e.target.value))}
                  placeholder="(555) 123-4567"
                  className="h-8 text-sm"
                  tabIndex={isNewMode ? 0 : -1}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-body text-muted-foreground">
                  Email
                </Label>
                <Input
                  type="email"
                  value={isNewMode ? value.email : ""}
                  onChange={(e) => updateNewField("email", e.target.value)}
                  placeholder="john@example.com"
                  className="h-8 text-sm"
                  tabIndex={isNewMode ? 0 : -1}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
