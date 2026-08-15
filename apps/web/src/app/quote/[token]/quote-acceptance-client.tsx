"use client";

import { useState } from "react";
import { QuoteReviewCard } from "@/components/quote-portal/quote-review-card";
import { QuoteResponseButtons } from "@/components/quote-portal/quote-response-buttons";
import { QuoteConfirmation } from "@/components/quote-portal/quote-confirmation";
import { QuoteExpiredView } from "@/components/quote-portal/quote-expired-view";
import { acceptPublicQuote, declinePublicQuote } from "@/actions/public-quote";
import { LicenseBadge } from "@/components/public/license-badge";
import { IconPrinter } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface QuoteData {
  business: {
    name: string;
    logoUrl: string | null;
    licenseNumber?: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    slug: string;
    timezone: string | null;
  };
  quote: {
    id: string;
    quoteNumber: string;
    status: string;
    issuedDate: string;
    expiryDate: string | null;
    lineItems: {
      description: string;
      quantity: string;
      unitPrice: string;
      total: string;
      itemType: string;
    }[];
    subtotal: string;
    taxAmount: string;
    discountAmount: string;
    totalAmount: string;
    notes: string | null;
    termsConditions: string | null;
    footerMessage: string | null;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    declineReason: string | null;
    customerScheduledDate: string | null;
    customerScheduledTime: string | null;
  };
  settings: {
    postAcceptanceScheduling: boolean;
    autoConvertToJob: boolean;
  };
}

type Step = "review" | "respond" | "confirmation";

interface QuoteAcceptanceClientProps {
  token: string;
  initialData: QuoteData;
}

export function QuoteAcceptanceClient({ token, initialData }: QuoteAcceptanceClientProps) {
  const { business, quote, settings } = initialData;

  // Already responded or expired — show status view
  const alreadyResponded = quote.status !== "sent";

  const [step, setStep] = useState<Step>(alreadyResponded ? "confirmation" : "review");
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<"accepted" | "declined" | null>(
    alreadyResponded ? (quote.status as "accepted" | "declined") : null,
  );
  const [jobCreated, setJobCreated] = useState(false);

  // The earliest date the customer may request, in the *business's* zone — the
  // browser's "today" can be a day ahead or behind it.
  const todayInBusinessTimezone = new Intl.DateTimeFormat("en-CA", {
    timeZone: business.timezone ?? "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Build booking portal URL with customer data pre-filled
  function buildBookingUrl(): string {
    const params = new URLSearchParams();
    if (quote.customerName) params.set("name", quote.customerName);
    if (quote.customerEmail) params.set("email", quote.customerEmail);
    if (quote.customerPhone) params.set("phone", quote.customerPhone);
    if (quote.customerAddress) params.set("address", quote.customerAddress);
    params.set("service", "consultation");
    params.set("quoteId", quote.id);
    const qs = params.toString();
    return `/book/${business.slug}${qs ? `?${qs}` : ""}`;
  }

  async function handleAccept(schedule?: {
    scheduledDate?: string;
    scheduledTime?: string;
  }) {
    setAccepting(true);
    setError(null);
    // QUO-26: this called `acceptPublicQuote(token)` with no second argument, so
    // the preferred date the API, the DB and the job conversion all support was
    // never sent.
    const result = await acceptPublicQuote(token, schedule);
    setAccepting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setResponseStatus("accepted");
    setJobCreated(result.data?.jobCreated ?? false);
    setStep("confirmation");
  }

  async function handleDecline(reason?: string) {
    setDeclining(true);
    setError(null);
    const result = await declinePublicQuote(token, { reason });
    setDeclining(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setResponseStatus("declined");
    setStep("confirmation");
  }

  return (
    <div className="quote-doc min-h-screen bg-surface-alt">
      {/* Letterhead. Left-aligned rather than centred: this is correspondence
          from a business, and a centred logo over a centred name is the shape
          of every template. */}
      <header className="border-b border-ink/15 bg-midnight dark:border-border dark:bg-card">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-4 px-5 py-6">
          <div className="flex items-center gap-3">
            {business.logoUrl && (
              // A plain <img>, deliberately: the URL is tenant-supplied R2
              // content, and next/image would need every such host in
              // `remotePatterns` before it would render at all.
              <img
                src={business.logoUrl}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded object-contain"
              />
            )}
            <div>
              <p className="font-heading text-lg font-semibold leading-tight text-white dark:text-foreground">
                {business.name}
              </p>
              {business.phone && (
                <p className="tnum font-mono text-[11px] text-white/60 dark:text-muted-foreground">
                  {business.phone}
                </p>
              )}
            </div>
          </div>
          <LicenseBadge licenseNumber={business.licenseNumber} />
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        {/* Error Banner */}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 font-body text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <div className="rounded-lg border border-ink/15 bg-card p-5 shadow-sm dark:border-border sm:p-8">
          {/* Expired */}
          {quote.status === "expired" && (
            <QuoteExpiredView
              quoteNumber={quote.quoteNumber}
              businessName={business.name}
              businessPhone={business.phone}
            />
          )}

          {/* Already accepted/declined (from initial load) */}
          {alreadyResponded && quote.status !== "expired" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-ink/15 pb-4 dark:border-border">
                <Badge variant={quote.status === "accepted" ? "default" : "secondary"}>
                  {quote.status === "accepted" ? "Accepted" : "Declined"}
                </Badge>
                <p className="font-body text-sm text-muted-foreground">
                  You&rsquo;ve already responded to this estimate.
                </p>
              </div>
              <QuoteReviewCard quote={quote} />
            </div>
          )}

          {/* Step: Review */}
          {!alreadyResponded && step === "review" && (
            <div className="space-y-7">
              <QuoteReviewCard quote={quote} />
              <div className="no-print flex justify-end border-t border-ink/10 pt-5 dark:border-border">
                <Button
                  onClick={() => setStep("respond")}
                  className="cursor-pointer bg-brand font-body text-brand-foreground hover:bg-brand/90"
                >
                  Respond to this estimate
                </Button>
              </div>
            </div>
          )}

          {/* Step: Respond */}
          {step === "respond" && (
            <div className="space-y-6">
              {/* The figure the customer is deciding on is repeated here at the
                  same weight it carries on the document, so the decision screen
                  never asks "how much was it again?". */}
              <div className="border-b border-ink/15 pb-5 dark:border-border">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">
                  {quote.quoteNumber}
                </p>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="font-heading text-lg font-semibold text-foreground">
                    Accept or decline
                  </h2>
                  <span className="tnum font-mono text-2xl font-medium text-foreground">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(Number(quote.totalAmount))}
                  </span>
                </div>
              </div>
              <QuoteResponseButtons
                onAccept={handleAccept}
                onDecline={handleDecline}
                accepting={accepting}
                declining={declining}
                schedulingEnabled={settings.postAcceptanceScheduling}
                minDate={todayInBusinessTimezone}
              />
            </div>
          )}

          {/* Step: Confirmation (after action) */}
          {step === "confirmation" && responseStatus && !alreadyResponded && (
            <QuoteConfirmation
              status={responseStatus}
              businessName={business.name}
              quoteNumber={quote.quoteNumber}
              jobCreated={jobCreated}
              bookingUrl={settings.postAcceptanceScheduling ? buildBookingUrl() : undefined}
            />
          )}
        </div>

        {/* Footer: the return address, plus the one action a paper document
            needs. People print estimates and set them beside competing bids. */}
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4 dark:border-border">
          <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            {business.address && (
              <>
                {business.address}
                {business.city && `, ${business.city}`}
                {business.state && `, ${business.state}`}
                {business.zipCode && ` ${business.zipCode}`}
              </>
            )}
            {business.phone && (
              <>
                <br />
                <span className="tnum">{business.phone}</span>
              </>
            )}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
            className="no-print cursor-pointer font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
          >
            <IconPrinter className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Print
          </Button>
        </footer>
      </main>
    </div>
  );
}
