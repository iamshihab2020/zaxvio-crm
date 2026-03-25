"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconMaximize } from "@tabler/icons-react";

interface InvoicePreviewProps {
  tenant: {
    businessName: string;
    ownerName: string;
    email: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
  };
  licenseNumber: string;
  paymentTerms: string;
  paymentInstructions: string;
  termsConditions: string;
  footerMessage: string;
}

function formatDate(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Shared invoice body used by both the thumbnail and the full-size dialog */
function InvoiceBody({
  tenant,
  cityStateZip,
  licenseNumber,
  paymentTerms,
  paymentInstructions,
  termsConditions,
  displayFooter,
}: {
  tenant: InvoicePreviewProps["tenant"];
  cityStateZip: string;
  licenseNumber: string;
  paymentTerms: string;
  paymentInstructions: string;
  termsConditions: string;
  displayFooter: string;
}) {
  return (
    <>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 30,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#E8652D",
              marginBottom: 4,
            }}
          >
            {tenant.businessName}
          </div>
          {tenant.ownerName && (
            <div style={{ fontSize: 9, color: "#666", marginBottom: 2 }}>
              {tenant.ownerName}
            </div>
          )}
          {tenant.phone && (
            <div style={{ fontSize: 9, color: "#666", marginBottom: 2 }}>
              {tenant.phone}
            </div>
          )}
          {tenant.email && (
            <div style={{ fontSize: 9, color: "#666", marginBottom: 2 }}>
              {tenant.email}
            </div>
          )}
          {tenant.address && (
            <div style={{ fontSize: 9, color: "#666", marginBottom: 2 }}>
              {tenant.address}
            </div>
          )}
          {cityStateZip && (
            <div style={{ fontSize: 9, color: "#666", marginBottom: 2 }}>
              {cityStateZip}
            </div>
          )}
          {licenseNumber && (
            <div style={{ fontSize: 9, color: "#666", marginBottom: 2 }}>
              License: {licenseNumber}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>INVOICE</div>
          <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
            INV-2026-0001
          </div>
        </div>
      </div>

      {/* Meta: Bill To + Invoice Details */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: "#999",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            Bill To
          </div>
          <div style={{ fontSize: 10, marginBottom: 2 }}>John Smith</div>
          <div style={{ fontSize: 10, marginBottom: 2 }}>john@example.com</div>
          <div style={{ fontSize: 10, marginBottom: 2 }}>(555) 987-6543</div>
          <div style={{ fontSize: 10, marginBottom: 2 }}>
            456 Oak Ave, Dallas, TX 75201
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: "#999",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            Invoice Details
          </div>
          <div style={{ fontSize: 10, marginBottom: 2 }}>
            Issued: {formatDate(0)}
          </div>
          <div style={{ fontSize: 10, marginBottom: 2 }}>
            Due: {formatDate(30)}
          </div>
          {paymentTerms && (
            <div style={{ fontSize: 10, marginBottom: 2 }}>
              Terms: {paymentTerms}
            </div>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            backgroundColor: "#f5f5f5",
            borderBottom: "1px solid #ddd",
            padding: "8px",
          }}
        >
          {(
            [
              { label: "Description", flex: 3, align: "left" as const },
              { label: "Qty", flex: 1, align: "right" as const },
              { label: "Price", flex: 1, align: "right" as const },
              { label: "Total", flex: 1, align: "right" as const },
            ] as const
          ).map((col) => (
            <div
              key={col.label}
              style={{
                flex: col.flex,
                fontSize: 8,
                fontWeight: 700,
                color: "#666",
                textTransform: "uppercase",
                textAlign: col.align,
              }}
            >
              {col.label}
            </div>
          ))}
        </div>
        {[
          {
            desc: "AC Unit Repair \u2014 Compressor",
            qty: "1",
            price: "$275.00",
            total: "$275.00",
          },
          {
            desc: "Replacement Air Filter (16x25x1)",
            qty: "3",
            price: "$25.00",
            total: "$75.00",
          },
        ].map((item) => (
          <div
            key={item.desc}
            style={{
              display: "flex",
              borderBottom: "1px solid #eee",
              padding: "8px",
            }}
          >
            <div style={{ flex: 3 }}>{item.desc}</div>
            <div style={{ flex: 1, textAlign: "right" }}>{item.qty}</div>
            <div style={{ flex: 1, textAlign: "right" }}>{item.price}</div>
            <div style={{ flex: 1, textAlign: "right" }}>{item.total}</div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {[
        { label: "Subtotal", value: "$350.00", bold: false },
        { label: "Tax (8.3%)", value: "$28.88", bold: false },
      ].map((row) => (
        <div
          key={row.label}
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: 120,
              textAlign: "right",
              paddingRight: 12,
              color: "#666",
            }}
          >
            {row.label}
          </div>
          <div style={{ width: 80, textAlign: "right" }}>{row.value}</div>
        </div>
      ))}

      <div
        style={{
          borderBottom: "1px solid #ddd",
          marginTop: 8,
          marginBottom: 8,
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            width: 120,
            textAlign: "right",
            paddingRight: 12,
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          Total
        </div>
        <div
          style={{
            width: 80,
            textAlign: "right",
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          $378.88
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            width: 120,
            textAlign: "right",
            paddingRight: 12,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Balance Due
        </div>
        <div
          style={{
            width: 80,
            textAlign: "right",
            fontWeight: 700,
            fontSize: 14,
            color: "#E8652D",
          }}
        >
          $378.88
        </div>
      </div>

      {/* Payment Instructions */}
      {paymentInstructions && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Payment Instructions
          </div>
          <div
            style={{
              fontSize: 9,
              color: "#444",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {paymentInstructions}
          </div>
        </div>
      )}

      {/* Terms & Conditions */}
      {termsConditions && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Terms & Conditions
          </div>
          <div
            style={{
              fontSize: 9,
              color: "#444",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {termsConditions}
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: 30,
          textAlign: "center",
          fontSize: 9,
          color: "#999",
          borderTop: "1px solid #eee",
          paddingTop: 8,
        }}
      >
        {displayFooter}
      </div>
    </>
  );
}

export function InvoicePreview({
  tenant,
  licenseNumber,
  paymentTerms,
  paymentInstructions,
  termsConditions,
  footerMessage,
}: InvoicePreviewProps) {
  const [open, setOpen] = useState(false);
  const cityStateZip = [tenant.city, tenant.state, tenant.zipCode]
    .filter(Boolean)
    .join(", ");
  const displayFooter = footerMessage || "Thank you for your business!";

  const bodyProps = {
    tenant,
    cityStateZip,
    licenseNumber,
    paymentTerms,
    paymentInstructions,
    termsConditions,
    displayFooter,
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">Live Preview</CardTitle>
          <p className="text-xs text-muted-foreground font-body">
            Click the preview to expand it full-size.
          </p>
        </CardHeader>
        <CardContent>
          {/* Clickable scaled thumbnail */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group relative w-full cursor-pointer overflow-hidden rounded border bg-white shadow-sm transition-shadow hover:shadow-md dark:border-border"
            style={{ height: 520 }}
          >
            {/* Expand icon overlay */}
            <div className="absolute right-2 top-2 z-10 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <IconMaximize className="h-3.5 w-3.5" />
            </div>
            <div
              style={{
                transform: "scale(0.52)",
                transformOrigin: "top left",
                width: "192%",
                fontFamily: "Helvetica, Arial, sans-serif",
                fontSize: 10,
                color: "#1a1a1a",
                padding: 40,
                textAlign: "left",
              }}
            >
              <InvoiceBody {...bodyProps} />
            </div>
          </button>
        </CardContent>
      </Card>

      {/* Full-size dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Invoice Preview
            </DialogTitle>
          </DialogHeader>
          <div
            className="rounded border bg-white p-10 dark:bg-white"
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 10,
              color: "#1a1a1a",
            }}
          >
            <InvoiceBody {...bodyProps} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
