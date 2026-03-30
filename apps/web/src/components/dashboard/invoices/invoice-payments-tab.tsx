"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  IconPlus,
  IconTrash,
  IconCash,
} from "@tabler/icons-react";
import { recordPayment, deletePayment } from "@/actions/invoices";

interface Payment {
  id: string;
  amount: string;
  paymentMethod: string | null;
  paymentDate: string;
  referenceNumber: string | null;
  notes: string | null;
  createdAt: string;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "credit_card", label: "Credit Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "other", label: "Other" },
];

interface InvoicePaymentsTabProps {
  invoiceId: string;
  payments: Payment[];
  balanceDue: string;
  isVoid: boolean;
  onUpdate: () => void;
}

export function InvoicePaymentsTab({
  invoiceId,
  payments,
  balanceDue,
  isVoid,
  onUpdate,
}: InvoicePaymentsTabProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const totalPaid = payments.reduce(
    (sum, p) => sum + parseFloat(p.amount),
    0,
  );

  function resetForm() {
    setAmount("");
    setPaymentMethod("cash");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setReferenceNumber("");
    setNotes("");
    setShowAdd(false);
  }

  async function handleAdd() {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    setSaving(true);
    const result = await recordPayment(invoiceId, {
      amount,
      paymentMethod,
      paymentDate,
      referenceNumber: referenceNumber || undefined,
      notes: notes || undefined,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Payment recorded");
      resetForm();
      onUpdate();
    }
  }

  async function handleDelete(paymentId: string) {
    const result = await deletePayment(invoiceId, paymentId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Payment removed");
      onUpdate();
    }
  }

  const methodLabel = (val: string | null) =>
    PAYMENT_METHODS.find((m) => m.value === val)?.label ?? val ?? "—";

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center justify-between mb-4 px-3 py-2 rounded-md bg-muted/30 border border-border">
        <div>
          <p className="text-xs text-muted-foreground font-body">Total Paid</p>
          <p className="text-sm font-semibold text-green-600 dark:text-green-400 font-body">
            ${totalPaid.toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground font-body">
            Balance Due
          </p>
          <p className="text-sm font-bold text-brand font-body">
            ${parseFloat(balanceDue).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Payments list */}
      {payments.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light mb-3">
            <IconCash className="h-5 w-5 text-brand" />
          </div>
          <p className="text-sm font-medium text-foreground font-body">
            No payments recorded
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Record a payment when your customer pays
          </p>
        </div>
      )}

      {payments.length > 0 && (
        <div className="space-y-2 mb-4">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground font-body">
                    ${parseFloat(p.amount).toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground font-body">
                    {methodLabel(p.paymentMethod)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-body">
                  {new Date(p.paymentDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {p.referenceNumber && ` · Ref: ${p.referenceNumber}`}
                </p>
                {p.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 font-body">
                    {p.notes}
                  </p>
                )}
              </div>
              {!isVoid && (
                <button
                  onClick={() => handleDelete(p.id)}
                  className="p-1 rounded hover:bg-muted cursor-pointer text-muted-foreground hover:text-destructive"
                  title="Remove payment"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add payment form */}
      {!isVoid && showAdd && (
        <div className="mt-3 rounded-md border border-border p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-body">Amount ($)</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-body">Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9 font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="font-body">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-body">Date</Label>
              <DatePicker
                value={paymentDate}
                onChange={setPaymentDate}
                placeholder="Payment date"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-body">Reference #</Label>
              <Input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Optional"
                className="text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-body">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={resetForm}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={saving}
              className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
            >
              {saving ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </div>
      )}

      {!isVoid && !showAdd && parseFloat(balanceDue) > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(true)}
          className="mt-3 cursor-pointer"
        >
          <IconPlus className="mr-1.5 h-3.5 w-3.5" />
          Record Payment
        </Button>
      )}
    </div>
  );
}
