"use client";

import { useState } from "react";
import {
  IconLink,
  IconCode,
  IconBrandWordpress,
  IconBrandWix,
  IconCheck,
  IconCopy,
  IconAlertTriangle,
  IconWorld,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareSettingsClientProps {
  slug: string;
  appUrl: string;
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn("shrink-0 gap-1.5", className)}
    >
      {copied ? (
        <>
          <IconCheck className="h-3.5 w-3.5 text-green-500" />
          Copied
        </>
      ) : (
        <>
          <IconCopy className="h-3.5 w-3.5" />
          Copy
        </>
      )}
    </Button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative rounded-lg bg-muted border border-border overflow-hidden">
      <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

export function ShareSettingsClient({ slug, appUrl }: ShareSettingsClientProps) {
  const bookingUrl = `${appUrl}/book/${slug}`;
  const embedUrl = `${appUrl}/book/${slug}?embed=1&source=embed`;
  const widgetSrc = `${appUrl}/widget.js`;

  const iframeCode = `<iframe\n  src="${embedUrl}"\n  width="100%"\n  height="680"\n  frameborder="0"\n  style="border-radius:12px;border:1px solid #e5e7eb;">\n</iframe>`;

  const scriptCode = `<script\n  async\n  src="${widgetSrc}"\n  data-slug="${slug}"\n  data-color="#2563EB">\n</script>`;

  return (
    <div className="space-y-6">
      {/* Direct Link */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
            <IconLink className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold font-heading">Direct Link</h3>
            <p className="mt-0.5 text-xs text-muted-foreground font-body">
              Share anywhere — no website required.
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {["Google Business Profile", "Facebook", "Instagram bio", "SMS", "Business cards"].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 min-w-0 rounded-md border border-border bg-muted/50 px-3 py-2">
                <p className="truncate text-sm font-mono text-foreground">{bookingUrl}</p>
              </div>
              <CopyButton text={bookingUrl} />
            </div>

            <div className="mt-3 flex items-center gap-3">
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline font-body"
              >
                <IconWorld className="h-3.5 w-3.5" />
                Preview booking page
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* iFrame Embed */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950">
            <IconBrandWix className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold font-heading">iFrame Embed</h3>
              <span className="rounded-full bg-green-100 dark:bg-green-950 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:text-green-400">
                Recommended
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground font-body">
              Paste the booking form inline on any page section.
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {["Wix", "Squarespace", "WordPress", "Webflow", "Any website"].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <CodeBlock code={iframeCode} />
              <div className="flex justify-end">
                <CopyButton text={iframeCode} />
              </div>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground font-body">
              Paste this inside an HTML block or code embed section. Adjust <code className="font-mono">height</code> to fit your page layout.
            </p>
          </div>
        </div>
      </div>

      {/* Script Widget */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950">
            <IconBrandWordpress className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold font-heading">Floating Button Widget</h3>
            <p className="mt-0.5 text-xs text-muted-foreground font-body">
              Adds a floating "Get Free Estimate" button to your website.
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {["WordPress", "Webflow", "Static HTML"].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/50 px-3 py-2.5">
              <IconAlertTriangle className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-500 mt-0.5" />
              <p className="text-xs text-yellow-800 dark:text-yellow-400 font-body">
                <strong>Does not work on Wix or Squarespace.</strong> Use the iFrame embed above instead.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <CodeBlock code={scriptCode} />
              <div className="flex justify-end">
                <CopyButton text={scriptCode} />
              </div>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground font-body">
              Paste before the <code className="font-mono">&lt;/body&gt;</code> tag. Change <code className="font-mono">data-color</code> to match your brand color.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
