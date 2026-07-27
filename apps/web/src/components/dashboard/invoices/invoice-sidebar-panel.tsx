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

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Customer Card */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
          <IconUser className="h-3.5 w-3.5" />
          Customer
        </h3>
        <div className="rounded-md bg-muted/50 p-3 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-brand/10 text-brand text-xs font-heading">
                {initials}
              </AvatarFallback>
            </Avatar>
            <Link
              href={`/customers/${invoice.customerId}`}
              className="text-sm font-medium text-foreground hover:text-brand transition-colors font-body"
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
              {invoice.customerEmail}
            </div>
          )}
          {invoice.customerAddress && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
              <IconMapPin className="h-3 w-3 shrink-0" />
              {invoice.customerAddress}
            </div>
          )}
        </div>
      </div>

      {/* Related Job */}
      <div className="space-y-3">
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
            <span className="text-sm font-medium text-foreground group-hover:text-brand transition-colors font-body">
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
      <div className="space-y-3">
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
