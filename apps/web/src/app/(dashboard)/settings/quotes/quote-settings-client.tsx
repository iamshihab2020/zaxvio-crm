"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "@/components/dashboard/settings/settings-section";
import { IconFileDescription, IconInfoCircle } from "@tabler/icons-react";
import { getTenant, updateTenant } from "@/actions/tenants";

interface TenantData {
  id: string;
  quoteTermsConditions: string | null;
  quoteFooterMessage: string | null;
  invoiceTermsConditions: string | null;
  invoiceFooterMessage: string | null;
}

export function QuoteSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsConditions, setTermsConditions] = useState("");
  const [footerMessage, setFooterMessage] = useState("");
  const [fallbackTerms, setFallbackTerms] = useState("");
  const [fallbackFooter, setFallbackFooter] = useState("");

  useEffect(() => {
    async function load() {
      const result = await getTenant();
      if (result.error) {
        setError(result.error);
      } else {
        const data = result.data as TenantData;
        setTermsConditions(data.quoteTermsConditions ?? "");
        setFooterMessage(data.quoteFooterMessage ?? "");
        setFallbackTerms(data.invoiceTermsConditions ?? "");
        setFallbackFooter(data.invoiceFooterMessage ?? "");
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    const result = await updateTenant({
      quoteTermsConditions: termsConditions || undefined,
      quoteFooterMessage: footerMessage || undefined,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Quote settings saved");
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <Skeleton className="mb-3 h-5 w-32" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-muted-foreground font-body">
        {error}
      </p>
    );
  }

  const previewTerms = termsConditions || fallbackTerms || "No terms set";
  const previewFooter =
    footerMessage ||
    fallbackFooter ||
    "This is an estimate. Final charges may vary.";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <SettingsSection icon={IconFileDescription} title="Quote PDF Settings">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="terms" className="font-body text-sm">
                Terms & Conditions
              </Label>
              <Textarea
                id="terms"
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
                placeholder={fallbackTerms || "Enter terms that appear on quote PDFs..."}
                rows={4}
                className="font-body text-sm"
              />
              {!termsConditions && fallbackTerms && (
                <p className="text-xs text-muted-foreground">
                  Falls back to your invoice terms if left empty.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="footer" className="font-body text-sm">
                Footer Message
              </Label>
              <Textarea
                id="footer"
                value={footerMessage}
                onChange={(e) => setFooterMessage(e.target.value)}
                placeholder={fallbackFooter || "Custom footer message for quote PDFs..."}
                rows={3}
                className="font-body text-sm"
              />
              {!footerMessage && fallbackFooter && (
                <p className="text-xs text-muted-foreground">
                  Falls back to your invoice footer if left empty.
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </SettingsSection>
      </div>

      <div className="space-y-4">
        <SettingsSection icon={IconFileDescription} title="PDF Preview">
          <div className="rounded-md border border-border bg-white dark:bg-white p-4 space-y-3">
            <div className="border-b border-gray-200 pb-2">
              <p className="text-[10px] font-bold text-gray-800 uppercase tracking-wider">
                Terms & Conditions
              </p>
              <p className="text-[9px] text-gray-600 mt-1 whitespace-pre-wrap">
                {previewTerms}
              </p>
            </div>
            <div className="pt-1 border-t border-gray-200">
              <p className="text-[9px] text-gray-500 text-center italic">
                This is an estimate. Final charges may vary.
              </p>
              <p className="text-[9px] text-gray-500 text-center">
                {previewFooter}
              </p>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection icon={IconInfoCircle} title="Tips">
          <ul className="space-y-2 text-xs text-muted-foreground font-body">
            <li>Leave a field empty to use your invoice settings as fallback.</li>
            <li>
              The footer defaults to &quot;This is an estimate. Final charges
              may vary.&quot; if both are empty.
            </li>
            <li>Changes here apply to all future quotes.</li>
          </ul>
        </SettingsSection>
      </div>
    </div>
  );
}
