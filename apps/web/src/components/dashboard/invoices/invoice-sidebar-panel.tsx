"use client";

import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/phone";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  IconUser,
  IconBriefcase,
  IconNote,
  IconPhone,
  IconMail,
  IconMapPin,
} from "@tabler/icons-react";
import type { InvoiceDetail } from "./invoice-detail-sheet";

interface InvoiceSidebarPanelProps {
  invoice: InvoiceDetail;
}

export function InvoiceSidebarPanel({ invoice }: InvoiceSidebarPanelProps) {
  const customerName =
    `${invoice.customerFirstName ?? ""} ${invoice.customerLastName ?? ""}`.trim() ||
    "Unknown";
  const initials =
    `${invoice.customerFirstName?.[0] ?? ""}${invoice.customerLastName?.[0] ?? ""}`.toUpperCase() ||
    "?";

  // Stacked in the 288px column from `xl`. Below that this panel runs full width
  // under the tabs, where three sections side by side use the room instead of
  // leaving a long, mostly empty card.
  return (
    <div className="space-y-5 p-4 sm:p-5 lg:grid lg:grid-cols-3 lg:gap-5 lg:space-y-0 xl:block xl:space-y-5">
      {/* Customer Card */}
      <div className="min-w-0 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
          <IconUser className="h-3.5 w-3.5" />
          Customer
        </h3>
        <div className="rounded-md bg-muted/50 p-3 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-brand/10 text-brand-ink text-xs font-heading">
                {initials}
              </AvatarFallback>
            </Avatar>
            <Link
              href={`/customers/${invoice.customerId}`}
              className="text-sm font-medium text-foreground hover:text-brand-ink transition-colors font-body"
            >
              {customerName}
            </Link>
          </div>
          {invoice.customerPhone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
              <IconPhone className="h-3 w-3 shrink-0" />
              {formatPhoneDisplay(invoice.customerPhone)}
            </div>
          )}
          {invoice.customerEmail && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
              <IconMail className="h-3 w-3 shrink-0" />
              <span className="min-w-0 break-words">{invoice.customerEmail}</span>
            </div>
          )}
          {invoice.customerAddress && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
              <IconMapPin className="h-3 w-3 shrink-0" />
              <span className="min-w-0 break-words">{invoice.customerAddress}</span>
            </div>
          )}
        </div>
      </div>

      {/* Related Job */}
      <div className="min-w-0 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
          <IconBriefcase className="h-3.5 w-3.5" />
          Related Job
        </h3>
        {invoice.jobId ? (
          <Link
            href={`/jobs/${invoice.jobId}`}
            className="flex items-center gap-2 rounded-md bg-muted/50 p-3 hover:bg-muted transition-colors group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light shrink-0">
              <IconBriefcase className="h-4 w-4 text-brand" />
            </div>
            <span className="text-sm font-medium text-foreground group-hover:text-brand-ink transition-colors font-body">
              View linked job
            </span>
          </Link>
        ) : (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground font-body">
              No linked job
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="min-w-0 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
          <IconNote className="h-3.5 w-3.5" />
          Notes
        </h3>
        <div className="rounded-md bg-muted/50 p-3">
          {invoice.notes ? (
            <p className="text-sm text-foreground font-body whitespace-pre-wrap">
              {invoice.notes}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic font-body">
              No notes
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
