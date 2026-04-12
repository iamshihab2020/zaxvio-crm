"use client";

import { useState } from "react";
import { QuoteReviewCard } from "@/components/quote-portal/quote-review-card";
import { QuoteResponseButtons } from "@/components/quote-portal/quote-response-buttons";
import { QuoteConfirmation } from "@/components/quote-portal/quote-confirmation";
import { QuoteExpiredView } from "@/components/quote-portal/quote-expired-view";
import { acceptPublicQuote, declinePublicQuote } from "@/actions/public-quote";
import { IconShieldCheck } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface QuoteData {
  business: {
    name: string;
    logoUrl: string | null;
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

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    const result = await acceptPublicQuote(token);
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
    <div className="min-h-screen bg-background">
      {/* Branded Header */}
      <header className="bg-midnight dark:bg-card border-b border-border">
        <div className="mx-auto max-w-xl px-4 py-8 text-center">
          {business.logoUrl && (
            <img
              src={business.logoUrl}
              alt={business.name}
              className="mx-auto mb-4 h-14 w-auto object-contain"
            />
          )}
          <h1 className="text-2xl font-bold font-heading text-white dark:text-foreground">
            {business.name}
          </h1>
          <p className="mt-2 text-sm text-white/70 dark:text-muted-foreground font-body">
            Estimate {quote.quoteNumber}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 dark:bg-muted/50 px-3 py-1">
            <IconShieldCheck className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs font-medium text-white/80 dark:text-muted-foreground">
              Licensed &amp; Insured
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-xl px-4 py-6">
        {/* Error Banner */}
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive font-body">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
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
              <div className="text-center">
                <Badge variant={quote.status === "accepted" ? "default" : "secondary"} className="mb-4">
                  {quote.status === "accepted" ? "Accepted" : "Declined"}
                </Badge>
                <p className="text-sm text-muted-foreground font-body">
                  This estimate has already been {quote.status}.
                </p>
              </div>
              <QuoteReviewCard business={business} quote={quote} />
            </div>
          )}

          {/* Step: Review */}
          {!alreadyResponded && step === "review" && (
            <div className="space-y-6">
              <QuoteReviewCard business={business} quote={quote} />
              <div className="flex justify-end">
                <Button
                  onClick={() => setStep("respond")}
                  className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
                >
                  Continue to Respond
                </Button>
              </div>
            </div>
          )}

          {/* Step: Respond */}
          {step === "respond" && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-semibold font-heading">
                  Respond to Estimate
                </h2>
                <p className="text-sm text-muted-foreground font-body">
                  {quote.quoteNumber} &mdash; Total:{" "}
                  <span className="font-semibold text-foreground">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(Number(quote.totalAmount))}
                  </span>
                </p>
              </div>
              <QuoteResponseButtons
                onAccept={() => handleAccept()}
                onDecline={handleDecline}
                accepting={accepting}
                declining={declining}
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

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground font-body">
          {business.address && (
            <>
              {business.address}
              {business.city && `, ${business.city}`}
              {business.state && `, ${business.state}`}
              {business.zipCode && ` ${business.zipCode}`}
              <br />
            </>
          )}
          {business.phone && <>Phone: {business.phone}</>}
        </p>
      </main>
    </div>
  );
}
