"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { ScrollFadeArea } from "@/components/reusable/scroll-fade-area";
import { toast } from "sonner";
import {
  IconPalette,
  IconLayoutSidebar,
  IconMaximize,
  IconX,
} from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CustomerPicker,
  type CustomerSelection,
} from "@/components/dashboard/customers/customer-picker";
import { createCustomer } from "@/actions/customers";
import { useViewPreference } from "@/hooks/use-view-preference";
import type { CalendarEventData } from "@/actions/calendar-events";

const EVENT_COLORS = [
  { value: "purple", label: "Purple", class: "bg-purple-500" },
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "green", label: "Green", class: "bg-green-500" },
  { value: "amber", label: "Amber", class: "bg-amber-500" },
  { value: "red", label: "Red", class: "bg-red-500" },
  { value: "teal", label: "Teal", class: "bg-teal-500" },
];

export interface EventFormData {
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  contactName: string;
  contactPhone: string;
  address: string;
  description: string;
  notes: string;
  color: string;
  customerId: string | null;
}

const emptyForm: EventFormData = {
  title: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  contactName: "",
  contactPhone: "",
  address: "",
  description: "",
  notes: "",
  color: "purple",
  customerId: null,
};

interface EventCreateDialogProps {
  event?: CalendarEventData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: EventFormData) => void;
  loading: boolean;
  defaultEventDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}

export function EventCreateDialog({
  event,
  open,
  onOpenChange,
  onSave,
  loading,
  defaultEventDate,
  defaultStartTime,
  defaultEndTime,
}: EventCreateDialogProps) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [customerSelection, setCustomerSelection] =
    useState<CustomerSelection | null>(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const { mode, setMode } = useViewPreference("events");

  const isEditing = !!event;
  const isSidebar = mode === "sidebar";

  useEffect(() => {
    if (event) {
      setForm({
        title: event.title,
        eventDate: event.eventDate,
        startTime: event.startTime ?? "",
        endTime: event.endTime ?? "",
        contactName: event.contactName ?? "",
        contactPhone: event.contactPhone ?? "",
        address: event.address ?? "",
        description: event.description ?? "",
        notes: event.notes ?? "",
        color: event.color ?? "purple",
        customerId: event.customerId ?? null,
      });
      if (event.customerId && event.contactName) {
        const [firstName = "", ...rest] = event.contactName.split(" ");
        setCustomerSelection({
          type: "existing",
          id: event.customerId,
          firstName,
          lastName: rest.join(" "),
          address: event.address ?? null,
          city: null,
          state: null,
          zipCode: null,
        });
      } else {
        setCustomerSelection(null);
      }
    } else {
      setForm({
        ...emptyForm,
        eventDate: defaultEventDate ?? "",
        startTime: defaultStartTime ?? "",
        endTime: defaultEndTime ?? "",
      });
      setCustomerSelection(null);
    }
    setErrors({});
    setCreatingCustomer(false);
  }, [event, open, defaultEventDate, defaultStartTime, defaultEndTime]);

  function handleCustomerChange(selection: CustomerSelection | null) {
    setCustomerSelection(selection);
    if (errors.customer) {
      setErrors((prev) => ({ ...prev, customer: undefined }));
    }
    if (selection?.type === "existing" && selection.address && !form.address) {
      setForm((prev) => ({ ...prev, address: selection.address! }));
    }
    if (selection?.type === "existing") {
      const name = [selection.firstName, selection.lastName].filter(Boolean).join(" ");
      setForm((prev) => ({ ...prev, contactName: name }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Partial<Record<string, string>> = {};

    if (!form.title.trim()) newErrors.title = "Title is required";
    if (!form.eventDate) newErrors.eventDate = "Date is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    let customerId: string | null = form.customerId;

    if (customerSelection?.type === "new") {
      setCreatingCustomer(true);
      const phone = customerSelection.phone.replace(/\D/g, "");
      const result = await createCustomer({
        firstName: customerSelection.firstName.trim(),
        lastName: customerSelection.lastName.trim(),
        phone: phone || undefined,
        email: customerSelection.email.trim() || undefined,
      });
      setCreatingCustomer(false);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      customerId = result.data.id;
      const contactName = [result.data.firstName, result.data.lastName]
        .filter(Boolean)
        .join(" ");
      toast.success(`Customer "${contactName}" created`);

      onSave({ ...form, customerId, contactName, contactPhone: phone });
      return;
    } else if (customerSelection?.type === "existing") {
      customerId = customerSelection.id;
    }

    onSave({ ...form, customerId });
  }

  function updateField(field: keyof EventFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function toggleMode() {
    setMode(isSidebar ? "dialog" : "sidebar");
  }

  /* ── Header with mode toggle + close ── */
  const header = (
    <div className="flex items-center justify-between px-6 pt-6 pb-2">
      <div>
        <h2 className="font-heading text-lg font-semibold">
          {isEditing ? "Edit Event" : "New Event"}
        </h2>
        <p className="text-sm text-muted-foreground font-body">
          {isEditing
            ? "Update this calendar event."
            : "Schedule a quick event on your calendar."}
        </p>
      </div>
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                onClick={toggleMode}
                type="button"
              >
                {isSidebar ? (
                  <IconMaximize className="h-4 w-4" />
                ) : (
                  <IconLayoutSidebar className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isSidebar ? "Switch to dialog view" : "Switch to sidebar view"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                onClick={() => onOpenChange(false)}
                type="button"
              >
                <IconX className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Close
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );

  /* ── Form content ── */
  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 min-h-0 flex-1">
      <ScrollFadeArea className="flex-1">
        <div className={`flex gap-6 px-6 pb-3 ${isSidebar ? "flex-col" : "flex-col lg:flex-row"}`}>
          {/* Left column: Event details */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="event-title" className="font-body">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="event-title"
                placeholder="e.g. Check HVAC at John's house"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                autoFocus
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title}</p>
              )}
            </div>

            {/* Date + Times */}
            <div className={`grid gap-3 ${isSidebar ? "grid-cols-1" : "grid-cols-3"}`}>
              <div className="space-y-2">
                <Label htmlFor="event-date" className="font-body">
                  Date <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  id="event-date"
                  value={form.eventDate}
                  onChange={(v) => updateField("eventDate", v)}
                  placeholder="Pick date"
                />
                {errors.eventDate && (
                  <p className="text-xs text-destructive">{errors.eventDate}</p>
                )}
              </div>
              <div className={`${isSidebar ? "grid grid-cols-2 gap-3" : "contents"}`}>
                <div className="space-y-2">
                  <Label htmlFor="event-start" className="font-body">
                    Start Time
                  </Label>
                  <TimePicker
                    id="event-start"
                    value={form.startTime}
                    onChange={(v) => updateField("startTime", v)}
                    placeholder="Start"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-end" className="font-body">
                    End Time
                  </Label>
                  <TimePicker
                    id="event-end"
                    value={form.endTime}
                    onChange={(v) => updateField("endTime", v)}
                    placeholder="End"
                  />
                </div>
              </div>
            </div>

            {/* Customer / Contact */}
            <div className="space-y-2">
              <Label className="font-body">Contact</Label>
              <CustomerPicker
                value={customerSelection}
                onChange={handleCustomerChange}
              />
              <p className="text-xs text-muted-foreground">
                Link an existing customer or create a new one.
              </p>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="event-address" className="font-body">
                Address
              </Label>
              <Input
                id="event-address"
                placeholder="123 Main St, Houston, TX"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
              />
            </div>
          </div>

          {/* Right column: Description, Notes, Color */}
          <div className={`space-y-4 ${isSidebar ? "" : "lg:w-[300px] shrink-0 lg:border-l lg:border-border lg:pl-6"}`}>
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="event-desc" className="font-body">
                Description
              </Label>
              <Textarea
                id="event-desc"
                placeholder="What's this event about..."
                rows={isSidebar ? 2 : 3}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="event-notes" className="font-body">
                Notes
              </Label>
              <Textarea
                id="event-notes"
                placeholder="Internal notes..."
                rows={2}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <IconPalette className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider font-body">
                  Color
                </span>
              </div>
              <div className="flex items-center gap-2">
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => updateField("color", c.value)}
                    className={`h-7 w-7 rounded-full ${c.class} ring-offset-background transition-all cursor-pointer ${
                      form.color === c.value
                        ? "ring-2 ring-ring ring-offset-2"
                        : "opacity-50 hover:opacity-100"
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollFadeArea>

      <div className="flex justify-end gap-2 px-6 pb-6 pt-2 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || creatingCustomer}
          className="cursor-pointer bg-brand text-brand-foreground hover:bg-brand/90"
        >
          {creatingCustomer
            ? "Creating contact..."
            : loading
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
                ? "Save Changes"
                : "Create Event"}
        </Button>
      </div>
    </form>
  );

  /* ── Sidebar mode ── */
  if (isSidebar) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="p-0 overflow-hidden flex flex-col sm:max-w-lg w-full">
          <SheetTitle className="sr-only">
            {isEditing ? "Edit Event" : "New Event"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {isEditing ? "Update this calendar event." : "Schedule a quick event."}
          </SheetDescription>
          {header}
          {formContent}
        </SheetContent>
      </Sheet>
    );
  }

  /* ── Dialog mode ── */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[850px] !grid-rows-[auto_1fr] max-h-[90vh] overflow-hidden p-0">
        {header}
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
