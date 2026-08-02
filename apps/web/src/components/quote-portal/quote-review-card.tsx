"use client";

import { formatDateOnly } from "@/lib/format";

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
  itemType: string;
}

interface QuoteReviewCardProps {
  business: {
    name: string;
    logoUrl: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
  };
  quote: {
    quoteNumber: string;
    issuedDate: string;
    expiryDate: string | null;
    lineItems: LineItem[];
    subtotal: string;
    taxAmount: string;
    discountAmount: string;
    totalAmount: string;
    notes: string | null;
    termsConditions: string | null;
    customerName: string;
  };
}

function money(value: string | number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

/** A quantity reads better as `2` than `2.00`, but `1.5` must survive. */
function qty(value: string): string {
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toString();
}

/**
 * The estimate, as a document rather than a web card.
 *
 * The portal was built in April; the house visual language was rebuilt at the
 * end of July around ruled work-order paper, DM Mono labels
 * (`uppercase tracking-[0.18em]`) and tabular figures. This page — the only one
 * in the quotes domain a *customer* ever sees, and the one where the money is
 * decided — used none of it: zero of six portal files touched `font-mono` or
 * `tnum`, on a page that is almost entirely a column of money.
 *
 * The structure here is the estimate pad a contractor actually hands you: a
 * ruled ladder of lines, labels in the left margin, and the total stamped at
 * the bottom rather than right-aligned at the same weight as "Subtotal".
 */
export function QuoteReviewCard({ business, quote }: QuoteReviewCardProps) {
  const hasDiscount = Number(quote.discountAmount) > 0;
  const hasTax = Number(quote.taxAmount) > 0;

  return (
    <div className="space-y-7">
      {/* ── Docket head: the quote number is the document's identity, so it is
             set in the utility face at display size, not the display face. ── */}
      <header className="border-b border-ink/15 pb-5 dark:border-border">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">
              Estimate
            </p>
            <p className="tnum mt-1 font-mono text-2xl font-medium text-foreground">
              {quote.quoteNumber}
            </p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-right">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Issued
            </dt>
            <dd className="tnum font-mono text-xs text-foreground">
              {formatDateOnly(quote.issuedDate)}
            </dd>
            {quote.expiryDate && (
              <>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Valid until
                </dt>
                <dd className="tnum font-mono text-xs text-foreground">
                  {formatDateOnly(quote.expiryDate)}
                </dd>
              </>
            )}
          </dl>
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Prepared for
          </span>
          <span className="font-body text-sm font-medium text-foreground">
            {quote.customerName}
          </span>
        </div>
      </header>

      {/* ── The ruled ladder. Not a <table> element: at 360px a four-column
             table either scrolls sideways or crushes the description, and the
             description is the part a customer reads. Each line becomes its own
             ruled row with the figure right-aligned in the margin. ── */}
      <section>
        <div className="flex items-baseline justify-between border-b border-ink/15 pb-1.5 dark:border-border">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Scope of work
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Amount
          </span>
        </div>

        <ul className="divide-y divide-ink/10 dark:divide-border/60">
          {quote.lineItems.map((item, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-body text-sm text-foreground">
                  {item.description}
                </p>
                {Number(item.quantity) !== 1 && (
                  <p className="tnum mt-0.5 font-mono text-xs text-muted-foreground">
                    {qty(item.quantity)} × {money(item.unitPrice)}
                  </p>
                )}
              </div>
              <p className="tnum shrink-0 font-mono text-sm text-foreground">
                {money(item.total)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Totals, then the stamp. Subtotal and tax stay deliberately quiet so
             the one number the customer is deciding on carries the page. ── */}
      <section className="space-y-4">
        <dl className="ml-auto w-full max-w-[16rem] space-y-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Subtotal
            </dt>
            <dd className="tnum font-mono text-sm text-muted-foreground">
              {money(quote.subtotal)}
            </dd>
          </div>
          {hasTax && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Tax
              </dt>
              <dd className="tnum font-mono text-sm text-muted-foreground">
                {money(quote.taxAmount)}
              </dd>
            </div>
          )}
          {hasDiscount && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand">
                Discount
              </dt>
              <dd className="tnum font-mono text-sm text-brand">
                −{money(quote.discountAmount)}
              </dd>
            </div>
          )}
        </dl>

        {/* The signature element: the total as a stamped block, ruled top and
            bottom, the way a figure is boxed on a paper work order. */}
        <div className="border-y-2 border-brand/70 bg-brand-light/60 px-4 py-4 dark:bg-brand-light/30">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
              Total due
            </span>
            <span className="tnum font-mono text-3xl font-medium leading-none text-foreground sm:text-4xl">
              {money(quote.totalAmount)}
            </span>
          </div>
        </div>
      </section>

      {quote.notes && (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Notes
          </p>
          <p className="mt-1.5 whitespace-pre-wrap font-body text-sm leading-relaxed text-foreground">
            {quote.notes}
          </p>
        </section>
      )}

      {quote.termsConditions && (
        <section className="border-t border-ink/15 pt-4 dark:border-border">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Terms
          </p>
          <p className="mt-1.5 whitespace-pre-wrap font-body text-xs leading-relaxed text-muted-foreground">
            {quote.termsConditions}
          </p>
        </section>
      )}
    </div>
  );
}
