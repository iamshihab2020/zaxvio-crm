"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ServiceType } from "@hvac-saas/types";
import { BookingProgressIndicator } from "@/components/booking-portal/booking-progress-indicator";
import { BookingStepService } from "@/components/booking-portal/booking-step-service";
import { BookingStepDate } from "@/components/booking-portal/booking-step-date";
import { BookingStepTime } from "@/components/booking-portal/booking-step-time";
import { BookingStepInfo, type CustomerInfo } from "@/components/booking-portal/booking-step-info";
import { submitPublicBooking, getPublicAvailability, getPublicSlots } from "@/actions/bookings";
import { LicenseBadge } from "@/components/public/license-badge";
import { cn } from "@/lib/utils";

interface InitialCustomer {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
}

interface BookingFormClientProps {
  slug: string;
  businessName: string;
  logoUrl: string | null;
  licenseNumber?: string | null;
  serviceTypes: string[];
  embed?: boolean;
  source?: "portal" | "embed" | "widget";
  initialCustomer?: InitialCustomer;
  initialService?: string;
  quoteId?: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

/** Slots older than this are refetched before the customer can pick from them. */
const STALE_THRESHOLD_MS = 60_000;

export function BookingFormClient({
  slug,
  businessName,
  logoUrl,
  licenseNumber,
  serviceTypes,
  embed = false,
  source = "portal",
  initialCustomer,
  initialService,
  quoteId,
}: BookingFormClientProps) {
  const router = useRouter();
  const [step, setStep] = useState(initialService ? 2 : 1);
  const [serviceType, setServiceType] = useState<ServiceType | null>(
    (initialService as ServiceType) ?? null,
  );
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    customerName: initialCustomer?.customerName ?? "",
    customerPhone: initialCustomer?.customerPhone ?? "",
    customerEmail: initialCustomer?.customerEmail ?? "",
    address: initialCustomer?.address ?? "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Availability (which *dates* are open) is prefetched — it drives the calendar
  // and is 3 cheap requests. Slots (which *times* are free on one date) are
  // fetched on demand.
  //
  // This page used to prefetch slots for every open date in three months: with
  // the default Mon-Fri schedule that is 47 extra requests, 51 in total, against
  // a 100/min production rate limit — 51% of the budget for a single page load,
  // and a 429 for the whole application after two. Worse, these requests reach
  // Fastify from the Next server, so every visitor shares one limiter key
  // (BOOK-02). The customer only ever needs slots for one date.
  const [availabilityCache, setAvailabilityCache] = useState<Map<string, Set<string>>>(new Map());
  const [slotsCache, setSlotsCache] = useState<Map<string, TimeSlot[]>>(new Map());
  const slotsFetchedAt = useRef<Map<string, number>>(new Map());
  const [initialLoading, setInitialLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Animation state
  const [animating, setAnimating] = useState(false);

  // Step transition with animation
  const goToStep = useCallback((newStep: number) => {
    setAnimating(true);
    // Brief fade out, then switch step, then fade in
    setTimeout(() => {
      setStep(newStep);
      setTimeout(() => setAnimating(false), 30);
    }, 150);
  }, []);

  /* ── Prefetch three months of open dates (3 requests) ── */
  useEffect(() => {
    let cancelled = false;

    async function prefetchAvailability() {
      const now = new Date();
      const months: string[] = [];
      for (let i = 0; i < 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }

      const monthResults = await Promise.all(
        months.map((m) => getPublicAvailability(slug, m).then((r) => ({ month: m, data: r.data }))),
      );
      if (cancelled) return;

      const dateCache = new Map<string, Set<string>>();
      for (const { month, data } of monthResults) {
        if (data?.availableDates) dateCache.set(month, new Set(data.availableDates));
      }
      setAvailabilityCache(dateCache);
      setInitialLoading(false);
    }

    prefetchAvailability();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  /** Fetch a month the customer navigated to beyond the prefetched three. */
  const fetchMonthAvailability = useCallback(
    async (monthStr: string) => {
      if (availabilityCache.has(monthStr)) return;
      const result = await getPublicAvailability(slug, monthStr);
      if (!result.data?.availableDates) return;
      setAvailabilityCache((prev) => {
        const next = new Map(prev);
        next.set(monthStr, new Set(result.data.availableDates));
        return next;
      });
    },
    [slug, availabilityCache],
  );

  /**
   * Load slots for one date. Serves the cache when it is fresh, otherwise
   * refetches — which is also what makes a retry after a 409 see the truth
   * rather than the slot that was just refused.
   */
  const loadSlots = useCallback(
    async (dateStr: string, force = false) => {
      const fetchedAt = slotsFetchedAt.current.get(dateStr);
      const isFresh = fetchedAt !== undefined && Date.now() - fetchedAt < STALE_THRESHOLD_MS;
      if (!force && isFresh) return;

      setSlotsLoading(true);
      const result = await getPublicSlots(slug, dateStr);
      setSlotsLoading(false);

      if (result.data?.slots) {
        slotsFetchedAt.current.set(dateStr, Date.now());
        setSlotsCache((prev) => {
          const next = new Map(prev);
          next.set(dateStr, result.data.slots);
          return next;
        });
      }
    },
    [slug],
  );

  const handleServiceSelect = (type: ServiceType) => {
    setServiceType(type);
    goToStep(2);
  };

  const handleDateSelect = (d: string) => {
    setDate(d);
    setTime(null);
    loadSlots(d);
    goToStep(3);
  };

  const handleTimeSelect = (t: string) => {
    setTime(t);
    goToStep(4);
  };

  const handleSubmit = async () => {
    if (!serviceType || !date || !time) return;
    setSubmitting(true);
    setError(null);

    const result = await submitPublicBooking(slug, {
      customerName: customerInfo.customerName.trim(),
      customerPhone: customerInfo.customerPhone.trim() || undefined,
      customerEmail: customerInfo.customerEmail.trim() || undefined,
      serviceType,
      bookingDate: date,
      preferredTime: time,
      address: customerInfo.address.trim() || undefined,
      description: customerInfo.description.trim() || undefined,
      source,
      quoteId: quoteId || undefined,
    });

    setSubmitting(false);

    if (result.error) {
      // The slot was taken while they were filling in their details. Sending
      // them back to step 3 with the *cached* list would show the slot that was
      // just refused and let them pick it again for the same 409 (BOOK-26).
      const slotGone = /no longer available|outside available hours|no availability/i.test(
        result.error,
      );
      if (slotGone) {
        slotsFetchedAt.current.delete(date);
        setSlotsCache((prev) => {
          const next = new Map(prev);
          next.delete(date);
          return next;
        });
        setTime(null);
        setError(result.error);
        loadSlots(date, true);
        goToStep(3);
        return;
      }
      setError(result.error);
    } else {
      // Redirect to the unique booking status page
      router.push(`/book/${slug}/status/${result.data.id}`);
    }
  };

  // Get all available dates merged from cache
  const getAllAvailableDates = useCallback((): Set<string> => {
    const merged = new Set<string>();
    for (const dates of availabilityCache.values()) {
      for (const d of dates) merged.add(d);
    }
    return merged;
  }, [availabilityCache]);

  const currentSlots = date ? slotsCache.get(date) ?? null : null;

  return (
    <div className={cn("bg-background", embed ? "min-h-0" : "min-h-screen")}>
      {/* Branded Header Band — hidden in embed mode */}
      {!embed && (
        <header className="bg-midnight dark:bg-card border-b border-border">
          <div className="mx-auto max-w-xl px-4 py-8 text-center">
            {logoUrl && (
              // Explicit dimensions so the highest-intent page in the product
              // does not shift its own header as the logo loads (BOOK-34).
              <div className="relative mx-auto mb-4 h-14 w-40">
                <Image
                  src={logoUrl}
                  alt={businessName}
                  fill
                  sizes="160px"
                  priority
                  unoptimized
                  className="object-contain"
                />
              </div>
            )}
            <h1 className="text-2xl font-bold font-heading text-white dark:text-foreground">
              {businessName}
            </h1>
            <p className="mt-2 text-sm text-white/70 dark:text-muted-foreground font-body">
              Schedule your service appointment in minutes
            </p>
            <div className="mt-3">
              <LicenseBadge licenseNumber={licenseNumber} />
            </div>
          </div>
        </header>
      )}

      {/* Step Content */}
      <main className="mx-auto max-w-xl px-4 py-6">
        {/* Progress Indicator */}
        <div className="mb-6 rounded-xl border border-border bg-card px-6 py-4 shadow-sm">
          <BookingProgressIndicator currentStep={step} totalSteps={5} />
        </div>

        {/* Animated Step Container */}
        <div
          className={cn(
            "rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8 transition-all duration-200",
            animating && "opacity-0 scale-[0.98]",
            !animating && "opacity-100 scale-100",
          )}
        >
          {step === 1 && (
            <BookingStepService
              serviceTypes={serviceTypes}
              selected={serviceType}
              onSelect={handleServiceSelect}
            />
          )}

          {step === 2 && (
            <BookingStepDate
              availableDates={getAllAvailableDates()}
              loading={initialLoading}
              selectedDate={date}
              onSelect={handleDateSelect}
              onBack={() => goToStep(1)}
              onMonthChange={fetchMonthAvailability}
            />
          )}

          {step === 3 && date && (
            <>
              {error && (
                <div
                  role="alert"
                  className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-body text-destructive"
                >
                  {error}
                </div>
              )}
              <BookingStepTime
                date={date}
                slots={slotsLoading ? null : currentSlots}
                selectedTime={time}
                onSelect={handleTimeSelect}
                onBack={() => goToStep(2)}
              />
            </>
          )}

          {step === 4 && (
            <BookingStepInfo
              info={customerInfo}
              onChange={setCustomerInfo}
              onSubmit={handleSubmit}
              onBack={() => goToStep(3)}
              submitting={submitting}
              error={error}
            />
          )}

          {/* Step 5: Redirects to /book/[slug]/status/[id] */}
        </div>

        {/* Trust Badge */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground font-body">
          <span>Free Estimates</span>
          <span className="text-border">·</span>
          <span>Same-Day Availability</span>
          <span className="text-border">·</span>
          <span>No Obligation</span>
        </div>
      </main>

      {/* Footer — hidden in embed mode */}
      {!embed && (
        <footer className="pb-8 text-center">
          <p className="text-xs text-muted-foreground/60">
            Powered by <span className="font-semibold">Zaxvio</span>
          </p>
        </footer>
      )}
    </div>
  );
}
