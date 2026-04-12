"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "@/components/dashboard/settings/settings-section";
import { Switch } from "@/components/ui/switch";
import { IconAlertTriangle, IconFileDescription, IconInfoCircle, IconLink } from "@tabler/icons-react";
import { getTenant, updateTenant } from "@/actions/tenants";

interface TenantData {
  id: string;
  slug: string;
  quoteTermsConditions: string | null;
  quoteFooterMessage: string | null;
  invoiceTermsConditions: string | null;
  invoiceFooterMessage: string | null;
  quoteOnlineAcceptanceEnabled: boolean | null;
  quotePostAcceptanceScheduling: boolean | null;
  quoteAutoConvertToJob: boolean | null;
}

interface QuoteSettingsClientProps {
  initialTenant?: TenantData | null;
}

export function QuoteSettingsClient({ initialTenant }: QuoteSettingsClientProps) {
  const [loading, setLoading] = useState(!initialTenant);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsConditions, setTermsConditions] = useState(initialTenant?.quoteTermsConditions ?? "");
  const [footerMessage, setFooterMessage] = useState(initialTenant?.quoteFooterMessage ?? "");
  const [fallbackTerms, setFallbackTerms] = useState(initialTenant?.invoiceTermsConditions ?? "");
  const [fallbackFooter, setFallbackFooter] = useState(initialTenant?.invoiceFooterMessage ?? "");
  const [slug, setSlug] = useState(initialTenant?.slug ?? "");
  const [onlineAcceptance, setOnlineAcceptance] = useState(initialTenant?.quoteOnlineAcceptanceEnabled ?? true);
  const [postAcceptanceScheduling, setPostAcceptanceScheduling] = useState(initialTenant?.quotePostAcceptanceScheduling ?? false);
  const [autoConvertToJob, setAutoConvertToJob] = useState(initialTenant?.quoteAutoConvertToJob ?? false);
  const [savingToggle, setSavingToggle] = useState<string | null>(null);

  useEffect(() => {
    if (initialTenant) return;
    async function load() {
      const result = await getTenant();
      if (result.error) {
        setError(result.error);
      } else {
        const data = result.data as TenantData;
        setSlug(data.slug ?? "");
        setTermsConditions(data.quoteTermsConditions ?? "");
        setFooterMessage(data.quoteFooterMessage ?? "");
        setFallbackTerms(data.invoiceTermsConditions ?? "");
        setFallbackFooter(data.invoiceFooterMessage ?? "");
        setOnlineAcceptance(data.quoteOnlineAcceptanceEnabled ?? true);
        setPostAcceptanceScheduling(data.quotePostAcceptanceScheduling ?? false);
        setAutoConvertToJob(data.quoteAutoConvertToJob ?? false);
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save a single toggle immediately
  async function autoSaveToggle(
    field: "quoteOnlineAcceptanceEnabled" | "quotePostAcceptanceScheduling" | "quoteAutoConvertToJob",
    value: boolean,
  ) {
    // Update local state immediately for instant feedback
    if (field === "quoteOnlineAcceptanceEnabled") {
      setOnlineAcceptance(value);
      // Turn off dependent toggles when disabling online acceptance
      if (!value) {
        setPostAcceptanceScheduling(false);
        setAutoConvertToJob(false);
      }
    }
    if (field === "quotePostAcceptanceScheduling") {
      setPostAcceptanceScheduling(value);
      if (value && !slug) {
        toast.warning("Your booking portal link is not set up yet. Make sure your business profile has a slug configured.");
      } else if (value) {
        toast.info("Customers will see a booking link after accepting quotes. Make sure your availability is configured in Settings \u203A Scheduling.");
      }
    }
    if (field === "quoteAutoConvertToJob") setAutoConvertToJob(value);

    setSavingToggle(field);

    // Build update payload — include dependent resets if disabling online acceptance
    const payload: Record<string, boolean> = { [field]: value };
    if (field === "quoteOnlineAcceptanceEnabled" && !value) {
      payload.quotePostAcceptanceScheduling = false;
      payload.quoteAutoConvertToJob = false;
    }

    const result = await updateTenant(payload as Parameters<typeof updateTenant>[0]);
    setSavingToggle(null);

    if (result.error) {
      toast.error("Failed to save setting");
      // Revert on failure
      if (field === "quoteOnlineAcceptanceEnabled") setOnlineAcceptance(!value);
      if (field === "quotePostAcceptanceScheduling") setPostAcceptanceScheduling(!value);
      if (field === "quoteAutoConvertToJob") setAutoConvertToJob(!value);
    } else {
      toast.success("Setting saved");
    }
  }

  // Save text fields (Terms & Footer) — explicit button
  async function handleSaveText() {
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
      <div className="lg:col-span-2 space-y-6">
        <SettingsSection icon={IconLink} title="Online Quote Acceptance">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="font-body text-sm font-medium">
                  Enable online acceptance
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow customers to accept or decline quotes from a link in the email.
                </p>
              </div>
              <Switch
                checked={onlineAcceptance}
                onCheckedChange={(v) => autoSaveToggle("quoteOnlineAcceptanceEnabled", v)}
                disabled={savingToggle !== null}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="font-body text-sm font-medium">
                  Post-acceptance scheduling
                </Label>
                <p className="text-xs text-muted-foreground">
                  After accepting, let customers pick a preferred date &amp; time.
                </p>
              </div>
              <Switch
                checked={postAcceptanceScheduling}
                onCheckedChange={(v) => autoSaveToggle("quotePostAcceptanceScheduling", v)}
                disabled={!onlineAcceptance || savingToggle !== null}
              />
            </div>

            {postAcceptanceScheduling && (
              <div className="rounded-md border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <IconAlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800 dark:text-amber-300 font-body space-y-1">
                    <p>
                      After accepting a quote, customers will see a link to your booking portal
                      {slug && (
                        <>
                          :{" "}
                          <span className="font-mono text-[11px] bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">
                            /book/{slug}
                          </span>
                        </>
                      )}
                    </p>
                    <p>
                      Make sure your availability schedule is configured in{" "}
                      <a href="/settings/bookings" className="underline font-medium hover:no-underline">
                        Settings &rsaquo; Scheduling
                      </a>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="font-body text-sm font-medium">
                  Auto-create job
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically create a job when a quote is accepted online.
                </p>
              </div>
              <Switch
                checked={autoConvertToJob}
                onCheckedChange={(v) => autoSaveToggle("quoteAutoConvertToJob", v)}
                disabled={!onlineAcceptance || savingToggle !== null}
              />
            </div>
          </div>
        </SettingsSection>

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
                onClick={handleSaveText}
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
