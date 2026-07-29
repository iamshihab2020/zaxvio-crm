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
import { IconPlus, IconTrash, IconCash, IconCheck } from "@tabler/icons-react";
import { ConfirmActionDialog } from "@/components/reusable/confirm-action-dialog";
import { useRecordPayment, useDeletePayment, usePayInFull, useTenantSettings } from "@/hooks/queries";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { tenantToday } from "@/lib/tenant-time";

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
  creditAmount?: string | null;
  /** Whether this invoice may take a payment at all — server rule mirrored. */
  canTakePayment: boolean;
  isVoid: boolean;
  onUpdate: () => void;
}

/**
 * Parse what a contractor actually types into the amount box.
 *
 * The field was a plain text input whose only client check was `> 0`, so
 * "1,000.00" and "$50" sailed past it and came back as a raw Zod error from the
 * server regex (INV-28).
 */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === "" || cleaned === ".") return null;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function InvoicePaymentsTab({
  invoiceId,
  payments,
  balanceDue,
  creditAmount,
  canTakePayment,
  isVoid,
  onUpdate,
}: InvoicePaymentsTabProps) {
  const tenantQuery = useTenantSettings();
  // INV-20: the date picker defaulted to the *browser's* UTC day, so at 7pm
  // Central it opened on tomorrow. `lib/tenant-time.ts` had zero references
  // under `components/dashboard/invoices/`.
  const timezone = tenantQuery.data?.data?.timezone ?? "UTC";
  const today = tenantToday(timezone);

  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(today);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const [payInFullOpen, setPayInFullOpen] = useState(false);

  const recordMutation = useRecordPayment();
  const deleteMutation = useDeletePayment();
  const payInFullMutation = usePayInFull();

  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const balance = parseFloat(balanceDue);
  const credit = parseFloat(creditAmount ?? "0");

  function resetForm() {
    setAmount("");
    setPaymentMethod("cash");
    setPaymentDate(today);
    setReferenceNumber("");
    setNotes("");
    setShowAdd(false);
  }

  function handleAdd() {
    const parsed = parseAmount(amount);
    if (parsed === null || parsed <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    // Overpayment is allowed — it becomes a credit on the invoice — but it is
    // almost always a typo, so say so rather than silently banking it.
    if (parsed > balance) {
      toast.warning(
        `That is ${formatMoney(parsed - balance)} more than the balance. The excess will be held as a credit.`,
      );
    }

    recordMutation.mutate(
      {
        id: invoiceId,
        data: {
          amount: parsed.toFixed(2),
          paymentMethod,
          paymentDate,
          referenceNumber: referenceNumber || undefined,
          notes: notes || undefined,
        },
      },
      {
        onSuccess: (res) => {
          if (res.error) return;
          resetForm();
          onUpdate();
        },
      },
    );
  }

  function handlePayInFull() {
    payInFullMutation.mutate(
      { id: invoiceId, data: { paymentMethod, paymentDate } },
      {
        onSuccess: (res) => {
          if (res.error) return;
          setPayInFullOpen(false);
          onUpdate();
        },
      },
    );
  }

  function confirmDelete() {
    if (!deletingPayment) return;
    deleteMutation.mutate(
      { id: invoiceId, paymentId: deletingPayment.id },
      {
        onSuccess: (res) => {
          if (res.error) return;
          setDeletingPayment(null);
          onUpdate();
        },
      },
    );
  }

  const methodLabel = (val: string | null) =>
    PAYMENT_METHODS.find((m) => m.value === val)?.label ?? val ?? "—";

  return (
    <div>
      {/* Summary */}
      <div className="mb-4 flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
        <div>
          <p className="text-xs text-muted-foreground font-body">Total Paid</p>
          <p className="text-sm font-semibold text-green-600 dark:text-green-400 font-body">
            {formatMoney(totalPaid)}
          </p>
        </div>
        {credit > 0 && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground font-body">Credit</p>
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 font-body">
              {formatMoney(credit)}
            </p>
          </div>
        )}
        <div className="text-right">
          <p className="text-xs text-muted-foreground font-body">Balance Due</p>
          <p className="text-sm font-bold text-brand font-body">
            {formatMoney(balanceDue)}
          </p>
        </div>
      </div>

      {/* Payments list */}
      {payments.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-8 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-light">
            <IconCash className="h-5 w-5 text-brand" />
          </div>
          <p className="text-sm font-medium text-foreground font-body">
            No payments recorded
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Record a payment when your customer pays
          </p>
        </div>
      )}

      {payments.length > 0 && (
        <div className="mb-4 space-y-2">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground font-body">
                    {formatMoney(p.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground font-body">
                    {methodLabel(p.paymentMethod)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-body">
                  {formatDateOnly(p.paymentDate)}
                  {p.referenceNumber && ` · Ref: ${p.referenceNumber}`}
                </p>
                {p.notes && (
                  <p className="mt-0.5 text-xs text-muted-foreground font-body">
                    {p.notes}
                  </p>
                )}
              </div>
              {!isVoid && (
                <Button
                  variant="ghost"
                  size="icon"
                  // DF-INV-05: this fired on click. Line items get a dialog; the
                  // action that reverses recorded money did not.
                  onClick={() => setDeletingPayment(p)}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Remove payment"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add payment form */}
      {canTakePayment && showAdd && (
        <div className="mt-3 space-y-3 rounded-md border border-border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-body" htmlFor="payment-amount">
                Amount ($)
              </Label>
              <Input
                id="payment-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={balance > 0 ? balance.toFixed(2) : "0.00"}
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
              <Label className="text-xs font-body" htmlFor="payment-ref">
                Reference #
              </Label>
              <Input
                id="payment-ref"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Optional"
                className="text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-body" htmlFor="payment-notes">
              Notes
            </Label>
            <Textarea
              id="payment-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={resetForm} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={recordMutation.isPending}
              className="cursor-pointer bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {recordMutation.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </div>
      )}

      {canTakePayment && !showAdd && balance > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {/*
            §4.1: "the customer handed me a cheque" is the single most common
            action on an invoice and it took five interactions. One tap now.
          */}
          <Button
            size="sm"
            onClick={() => setPayInFullOpen(true)}
            className="cursor-pointer bg-brand text-brand-foreground hover:bg-brand/90"
          >
            <IconCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark paid in full
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdd(true)}
            className="cursor-pointer"
          >
            <IconPlus className="mr-1.5 h-3.5 w-3.5" />
            Record partial payment
          </Button>
        </div>
      )}

      {/* The server refuses payments on drafts; say why rather than hiding it. */}
      {!canTakePayment && !isVoid && balance > 0 && (
        <p className="mt-3 rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground font-body">
          Send this invoice before recording a payment against it.
        </p>
      )}

      <ConfirmActionDialog
        title="Remove payment"
        description={
          deletingPayment
            ? `Remove this ${formatMoney(deletingPayment.amount)} payment? The invoice balance and status will be recalculated.`
            : ""
        }
        open={!!deletingPayment}
        onOpenChange={(open) => !open && setDeletingPayment(null)}
        onConfirm={confirmDelete}
        confirmLabel="Remove payment"
        loading={deleteMutation.isPending}
      />

      <ConfirmActionDialog
        title="Mark paid in full"
        description={`Record a ${formatMoney(balanceDue)} payment and close this invoice?`}
        open={payInFullOpen}
        onOpenChange={setPayInFullOpen}
        onConfirm={handlePayInFull}
        confirmLabel="Mark paid"
        loading={payInFullMutation.isPending}
      />
    </div>
  );
}
