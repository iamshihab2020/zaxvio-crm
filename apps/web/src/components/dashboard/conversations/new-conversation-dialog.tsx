"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { IconMail, IconMessage } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  CustomerPicker,
  type CustomerSelection,
} from "@/components/dashboard/customers/customer-picker";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (customerId: string, channel: "sms" | "email", subject?: string) => void;
  isLoading?: boolean;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: NewConversationDialogProps) {
  const [customer, setCustomer] = useState<CustomerSelection | null>(null);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState("");

  function handleConfirm() {
    if (!customer || customer.type !== "existing") {
      setError("Please select an existing customer.");
      return;
    }
    if (channel === "sms") return; // blocked by UI
    setError("");
    onConfirm(customer.id, channel, subject.trim() || undefined);
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      setCustomer(null);
      setChannel("email");
      setSubject("");
      setError("");
    }
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Customer picker */}
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <CustomerPicker
              value={customer}
              onChange={setCustomer}
              error={error}
            />
          </div>

          {/* Channel selector */}
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <div className="flex gap-2">
              {/* Email option */}
              <button
                type="button"
                onClick={() => setChannel("email")}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors cursor-pointer",
                  channel === "email"
                    ? "border-brand bg-brand-light text-brand"
                    : "border-border hover:bg-muted",
                )}
              >
                <IconMail className="h-4 w-4 shrink-0" />
                <span className="font-medium">Email</span>
              </button>

              {/* SMS option — disabled placeholder */}
              <button
                type="button"
                disabled
                className="flex flex-1 items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm opacity-50 cursor-not-allowed"
              >
                <IconMessage className="h-4 w-4 shrink-0" />
                <span className="font-medium">SMS</span>
                <Badge
                  variant="secondary"
                  className="ml-auto text-[10px] px-1.5 py-0 h-4"
                >
                  Coming Soon
                </Badge>
              </button>
            </div>
          </div>

          {/* Subject (email only) */}
          {channel === "email" && (
            <div className="space-y-1.5">
              <Label>Subject (optional)</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Your HVAC service appointment"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!customer || channel === "sms" || isLoading}
          >
            {isLoading ? "Starting…" : "Start Conversation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
