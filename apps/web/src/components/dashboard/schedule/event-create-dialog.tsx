"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
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
import { motion, AnimatePresence } from "motion/react";
import {
  IconCalendarEvent,
  IconClock,
  IconUser,
  IconMapPin,
  IconFileDescription,
  IconPalette,
  IconNotes,
  IconLayoutSidebar,
  IconMaximize,
  IconX,
  IconCheck,
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
import { cn } from "@/lib/utils";
import type { CalendarEventData } from "@/actions/calendar-events";

const EVENT_COLORS = [
  { value: "purple", label: "Purple", class: "bg-purple-500", ring: "ring-purple-500/30" },
  { value: "blue", label: "Blue", class: "bg-blue-500", ring: "ring-blue-500/30" },
  { value: "green", label: "Green", class: "bg-green-500", ring: "ring-green-500/30" },
  { value: "amber", label: "Amber", class: "bg-amber-500", ring: "ring-amber-500/30" },
  { value: "red", label: "Red", class: "bg-red-500", ring: "ring-red-500/30" },
  { value: "teal", label: "Teal", class: "bg-teal-500", ring: "ring-teal-500/30" },
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

/* ── Section wrapper with icon ── */
function FormSection({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-body">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
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

  const selectedColor = EVENT_COLORS.find((c) => c.value === form.color) ?? EVENT_COLORS[0];

  /* ── Header ── */
  const header = (
    <div className="flex items-center justify-between px-6 pt-5 pb-3">
      <div className="flex items-center gap-3">
        <div className={cn("flex items-center justify-center h-9 w-9 rounded-lg", selectedColor.class)}>
          <IconCalendarEvent className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold leading-tight">
            {isEditing ? "Edit Event" : "New Event"}
          </h2>
          <p className="text-xs text-muted-foreground font-body mt-0.5">
            {isEditing
              ? "Update this calendar event."
              : "Schedule a quick event on your calendar."}
          </p>
        </div>
      </div>
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={toggleMode}
                type="button"
              >
                {isSidebar ? (
                  <IconMaximize className="h-3.5 w-3.5" />
                ) : (
                  <IconLayoutSidebar className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isSidebar ? "Switch to dialog" : "Switch to sidebar"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => onOpenChange(false)}
                type="button"
              >
                <IconX className="h-3.5 w-3.5" />
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
    <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
      <ScrollFadeArea className="flex-1">
        <div className={cn(
          "px-6 pb-4 space-y-5",
          !isSidebar && "lg:grid lg:grid-cols-[1fr_280px] lg:gap-6 lg:space-y-0",
        )}>
          {/* ── Left column ── */}
          <div className="space-y-5">
            {/* Title — prominent, no section header needed */}
            <div className="space-y-2">
              <Label htmlFor="event-title" className="font-body text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="event-title"
                placeholder="e.g. Check HVAC at John's house"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                autoFocus
                className={cn(
                  "h-10 text-sm",
                  errors.title && "border-destructive focus-visible:ring-destructive/30",
                )}
              />
              <AnimatePresence>
                {errors.title && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-xs text-destructive"
                  >
                    {errors.title}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Date & Time section */}
            <FormSection icon={IconClock} label="Date & Time">
              <div className={cn("grid gap-3", isSidebar ? "grid-cols-1" : "grid-cols-3")}>
                <div className="space-y-1.5">
                  <Label htmlFor="event-date" className="text-xs text-muted-foreground">
                    Date <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker
                    id="event-date"
                    value={form.eventDate}
                    onChange={(v) => updateField("eventDate", v)}
                    placeholder="Pick date"
                  />
                  <AnimatePresence>
                    {errors.eventDate && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="text-xs text-destructive"
                      >
                        {errors.eventDate}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <div className={cn(isSidebar ? "grid grid-cols-2 gap-3" : "contents")}>
                  <div className="space-y-1.5">
                    <Label htmlFor="event-start" className="text-xs text-muted-foreground">
                      Start
                    </Label>
                    <TimePicker
                      id="event-start"
                      value={form.startTime}
                      onChange={(v) => updateField("startTime", v)}
                      placeholder="Start"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="event-end" className="text-xs text-muted-foreground">
                      End
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
            </FormSection>

            {/* Contact section */}
            <FormSection icon={IconUser} label="Contact">
              <CustomerPicker
                value={customerSelection}
                onChange={handleCustomerChange}
              />
              <p className="text-[0.7rem] text-muted-foreground/70">
                Link an existing customer or create a new one.
              </p>
            </FormSection>

            {/* Address */}
            <FormSection icon={IconMapPin} label="Location">
              <Input
                id="event-address"
                placeholder="123 Main St, Houston, TX"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                className="h-9 text-sm"
              />
            </FormSection>
          </div>

          {/* ── Right column ── */}
          <div className={cn(
            "space-y-5",
            !isSidebar && "lg:border-l lg:border-border lg:pl-6",
          )}>
            {/* Description */}
            <FormSection icon={IconFileDescription} label="Description">
              <Textarea
                id="event-desc"
                placeholder="What's this event about..."
                rows={isSidebar ? 2 : 3}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                className="text-sm resize-none"
              />
            </FormSection>

            {/* Notes */}
            <FormSection icon={IconNotes} label="Notes">
              <Textarea
                id="event-notes"
                placeholder="Internal notes..."
                rows={2}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className="text-sm resize-none"
              />
            </FormSection>

            {/* Color picker */}
            <FormSection icon={IconPalette} label="Color">
              <div className="flex items-center gap-2.5">
                {EVENT_COLORS.map((c) => {
                  const isSelected = form.color === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => updateField("color", c.value)}
                      className={cn(
                        "relative h-7 w-7 rounded-full cursor-pointer transition-all duration-200",
                        c.class,
                        isSelected
                          ? `ring-2 ${c.ring} ring-offset-2 ring-offset-background scale-110`
                          : "opacity-50 hover:opacity-80 hover:scale-105",
                      )}
                      title={c.label}
                    >
                      <AnimatePresence>
                        {isSelected && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            className="absolute inset-0 flex items-center justify-center"
                          >
                            <IconCheck className="h-3.5 w-3.5 text-white" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  );
                })}
              </div>
            </FormSection>
          </div>
        </div>
      </ScrollFadeArea>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-6 pb-5 pt-3 border-t border-border">
        <p className="text-[0.65rem] text-muted-foreground/50 hidden sm:block">
          Press <kbd className="px-1 py-0.5 rounded bg-muted text-[0.6rem] font-mono">Enter</kbd> to save
        </p>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={loading || creatingCustomer}
            className="cursor-pointer bg-brand text-brand-foreground hover:bg-brand/90 gap-1.5 min-w-[110px]"
          >
            {creatingCustomer ? (
              "Creating contact..."
            ) : loading ? (
              isEditing ? "Saving..." : "Creating..."
            ) : isEditing ? (
              <>
                <IconCheck className="h-3.5 w-3.5" />
                Save Changes
              </>
            ) : (
              <>
                <IconCalendarEvent className="h-3.5 w-3.5" />
                Create Event
              </>
            )}
          </Button>
        </div>
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
      <DialogContent className="sm:max-w-[820px] !grid-rows-[auto_1fr] max-h-[85vh] overflow-hidden p-0">
        {header}
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
