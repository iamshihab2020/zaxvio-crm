"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ServiceType } from "@hvac-saas/types";
import { BookingProgressIndicator } from "@/components/booking-portal/booking-progress-indicator";
import { BookingStepService } from "@/components/booking-portal/booking-step-service";
import { BookingStepDate } from "@/components/booking-portal/booking-step-date";
import { BookingStepTime } from "@/components/booking-portal/booking-step-time";
import { BookingStepInfo, type CustomerInfo } from "@/components/booking-portal/booking-step-info";
import { submitPublicBooking, getPublicAvailability, getPublicSlots } from "@/actions/bookings";
import { IconShieldCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface BookingFormClientProps {
  slug: string;
  businessName: string;
  logoUrl: string | null;
  serviceTypes: string[];
  embed?: boolean;
  source?: "portal" | "embed" | "widget";
}

interface TimeSlot {
  time: string;
  available: boolean;
}

export function BookingFormClient({
  slug,
  businessName,
  logoUrl,
  serviceTypes,
  embed = false,
  source = "portal",
}: BookingFormClientProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [prevStep, setPrevStep] = useState(1);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    address: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fetched data caches
  const [availabilityCache, setAvailabilityCache] = useState<Map<string, Set<string>>>(new Map());
  const [slotsCache, setSlotsCache] = useState<Map<string, TimeSlot[]>>(new Map());
  const [initialLoading, setInitialLoading] = useState(true);

  // Animation state
  const [animating, setAnimating] = useState(false);
  const animationDirection = step > prevStep ? "forward" : "backward";

  // Step transition with animation
  const goToStep = useCallback((newStep: number) => {
    setPrevStep(step);
    setAnimating(true);
    // Brief fade out, then switch step, then fade in
    setTimeout(() => {
      setStep(newStep);
      setTimeout(() => setAnimating(false), 30);
    }, 150);
  }, [step]);

  // Pre-fetch ALL data on page load (while user picks service)
  useEffect(() => {
    async function prefetchEverything() {
      // 1. Fetch 3 months of availability in parallel
      const now = new Date();
      const months: string[] = [];
      for (let i = 0; i < 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }

      const monthResults = await Promise.all(
        months.map((m) => getPublicAvailability(slug, m).then((r) => ({ month: m, data: r.data }))),
      );

      const dateCache = new Map<string, Set<string>>();
      const allDates: string[] = [];
      for (const { month, data } of monthResults) {
        if (data?.availableDates) {
          dateCache.set(month, new Set(data.availableDates));
          allDates.push(...data.availableDates);
        }
      }
      setAvailabilityCache(dateCache);
      setInitialLoading(false);

      // 2. Fetch slots for ALL available dates in parallel (batched)
      const BATCH_SIZE = 5;
      const slotResults = new Map<string, TimeSlot[]>();
      for (let i = 0; i < allDates.length; i += BATCH_SIZE) {
        const batch = allDates.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map((d) => getPublicSlots(slug, d).then((r) => ({ date: d, slots: r.data?.slots }))),
        );
        for (const { date: d, slots } of results) {
          if (slots) slotResults.set(d, slots);
        }
        // Update cache progressively so it's available as soon as possible
        setSlotsCache(new Map(slotResults));
      }
    }
    prefetchEverything();
  }, [slug]);

  // Fetch a new month if user navigates beyond the pre-fetched 3 months
  const fetchMonthAvailability = useCallback(async (monthStr: string) => {
    if (availabilityCache.has(monthStr)) return;
    const result = await getPublicAvailability(slug, monthStr);
    if (result.data?.availableDates) {
      setAvailabilityCache((prev) => {
        const next = new Map(prev);
        next.set(monthStr, new Set(result.data.availableDates));
        return next;
      });
      // Also fetch slots for these new dates
      for (const d of result.data.availableDates) {
        if (!slotsCache.has(d)) {
          getPublicSlots(slug, d).then((r) => {
            if (r.data?.slots) {
              setSlotsCache((prev) => {
                const next = new Map(prev);
                next.set(d, r.data.slots);
                return next;
              });
            }
          });
        }
      }
    }
  }, [slug, availabilityCache, slotsCache]);

  const handleServiceSelect = (type: ServiceType) => {
    setServiceType(type);
    goToStep(2);
  };

  const handleDateSelect = (d: string) => {
    setDate(d);
    setTime(null);
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
    });

    setSubmitting(false);

    if (result.error) {
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

  return (
    <div className={cn("bg-background", embed ? "min-h-0" : "min-h-screen")}>
      {/* Branded Header Band — hidden in embed mode */}
      {!embed && (
        <header className="bg-midnight dark:bg-card border-b border-border">
          <div className="mx-auto max-w-xl px-4 py-8 text-center">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={businessName}
                className="mx-auto mb-4 h-14 w-auto object-contain"
              />
            )}
            <h1 className="text-2xl font-bold font-heading text-white dark:text-foreground">
              {businessName}
            </h1>
            <p className="mt-2 text-sm text-white/70 dark:text-muted-foreground font-body">
              Schedule your service appointment in minutes
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 dark:bg-muted/50 px-3 py-1">
              <IconShieldCheck className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs font-medium text-white/80 dark:text-muted-foreground">
                Licensed &amp; Insured
              </span>
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
            <BookingStepTime
              date={date}
              slots={slotsCache.get(date) ?? null}
              selectedTime={time}
              onSelect={handleTimeSelect}
              onBack={() => goToStep(2)}
            />
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
