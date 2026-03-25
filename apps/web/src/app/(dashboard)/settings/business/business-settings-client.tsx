"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BusinessForm } from "@/components/dashboard/settings/business-form";
import { BusinessSidebar } from "@/components/dashboard/settings/business-sidebar";
import { getTenant } from "@/actions/tenants";

export interface TenantData {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  defaultTaxRate: string | null;
  googleReviewUrl: string | null;
  timezone: string | null;
  licenseNumber: string | null;
  invoicePaymentTerms: string | null;
  invoicePaymentInstructions: string | null;
  invoiceTermsConditions: string | null;
  invoiceFooterMessage: string | null;
}

export function BusinessSettingsClient() {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const result = await getTenant();
      if (result.error) {
        setError(result.error);
      } else {
        setTenant(result.data as TenantData);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border bg-card p-6">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-6">
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <p className="text-sm text-muted-foreground font-body">
        {error ?? "Unable to load business settings. Please try refreshing."}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <BusinessForm tenant={tenant} onSaved={(updated) => setTenant(updated as unknown as TenantData)} />
      </div>
      <div>
        <BusinessSidebar tenant={tenant} />
      </div>
    </div>
  );
}
