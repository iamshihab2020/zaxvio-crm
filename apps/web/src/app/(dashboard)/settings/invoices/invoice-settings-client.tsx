"use client";

import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InvoiceForm,
  type InvoiceFormValues,
} from "@/components/dashboard/settings/invoice-form";
import { InvoicePreview } from "@/components/dashboard/settings/invoice-preview";
import { SettingsSection } from "@/components/dashboard/settings/settings-section";
import { getTenant } from "@/actions/tenants";
import { IconInfoCircle } from "@tabler/icons-react";

interface TenantData {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  licenseNumber: string | null;
  invoicePaymentTerms: string | null;
  invoicePaymentInstructions: string | null;
  invoiceTermsConditions: string | null;
  invoiceFooterMessage: string | null;
}

interface InvoiceSettingsClientProps {
  initialTenant?: TenantData | null;
}

export function InvoiceSettingsClient({ initialTenant }: InvoiceSettingsClientProps) {
  const [tenant, setTenant] = useState<TenantData | null>(initialTenant ?? null);
  const [loading, setLoading] = useState(!initialTenant);
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<InvoiceFormValues>(() => {
    if (initialTenant) {
      return {
        licenseNumber: initialTenant.licenseNumber ?? "",
        invoicePaymentTerms: initialTenant.invoicePaymentTerms ?? "",
        invoicePaymentInstructions: initialTenant.invoicePaymentInstructions ?? "",
        invoiceTermsConditions: initialTenant.invoiceTermsConditions ?? "",
        invoiceFooterMessage: initialTenant.invoiceFooterMessage ?? "",
      };
    }
    return {
      licenseNumber: "",
      invoicePaymentTerms: "",
      invoicePaymentInstructions: "",
      invoiceTermsConditions: "",
      invoiceFooterMessage: "",
    };
  });

  useEffect(() => {
    if (initialTenant) return;
    async function load() {
      const result = await getTenant();
      if (result.error) {
        setError(result.error);
      } else {
        const data = result.data as TenantData;
        setTenant(data);
        setFormValues({
          licenseNumber: data.licenseNumber ?? "",
          invoicePaymentTerms: data.invoicePaymentTerms ?? "",
          invoicePaymentInstructions: data.invoicePaymentInstructions ?? "",
          invoiceTermsConditions: data.invoiceTermsConditions ?? "",
          invoiceFooterMessage: data.invoiceFooterMessage ?? "",
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleFormChange = useCallback((values: InvoiceFormValues) => {
    setFormValues(values);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-6">
            <Skeleton className="mb-3 h-5 w-32" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <p className="text-sm text-muted-foreground font-body">
        {error ?? "Unable to load invoice settings. Please try refreshing."}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <InvoiceForm
          tenant={tenant}
          onFormChange={handleFormChange}
          onSaved={(updated) => setTenant(updated as unknown as TenantData)}
        />
      </div>
      <div className="space-y-4">
        <InvoicePreview
          tenant={tenant}
          licenseNumber={formValues.licenseNumber}
          paymentTerms={formValues.invoicePaymentTerms}
          paymentInstructions={formValues.invoicePaymentInstructions}
          termsConditions={formValues.invoiceTermsConditions}
          footerMessage={formValues.invoiceFooterMessage}
        />
        <SettingsSection icon={IconInfoCircle} title="Tips">
          <ul className="space-y-2 text-xs text-muted-foreground font-body">
            <li>Leave a field empty to hide it from the PDF.</li>
            <li>
              Payment terms appear next to the due date (e.g. &quot;Net
              30&quot;).
            </li>
            <li>
              The footer defaults to &quot;Thank you for your business!&quot;
              if left blank.
            </li>
            <li>Changes here apply to all future invoices.</li>
          </ul>
        </SettingsSection>
      </div>
    </div>
  );
}
