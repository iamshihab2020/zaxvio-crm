"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconArrowLeft,
  IconDevices2,
  IconShieldCheck,
  IconMapPin,
  IconCalendar,
  IconUser,
  IconHash,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefrigerantLogsPanel } from "@/components/dashboard/equipment/refrigerant-logs-panel";
import { AssetServiceHistoryTab } from "@/components/dashboard/equipment/asset-service-history-tab";

interface AssetData {
  id: string;
  equipmentType: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  installDate: string | null;
  warrantyExpiry: string | null;
  location: string | null;
  notes: string | null;
  customerId: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AssetDetailClientProps {
  asset: AssetData;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getWarrantyBadge(warrantyExpiry: string | null) {
  if (!warrantyExpiry) return null;
  const expiry = new Date(warrantyExpiry);
  const now = new Date();
  const daysLeft = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysLeft < 0)
    return {
      label: "Expired",
      className:
        "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    };
  if (daysLeft <= 90)
    return {
      label: `Expires in ${daysLeft}d`,
      className:
        "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    };
  return {
    label: "Under Warranty",
    className:
      "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  };
}

export function AssetDetailClient({ asset }: AssetDetailClientProps) {
  const router = useRouter();
  const warranty = getWarrantyBadge(asset.warrantyExpiry);
  const customerName =
    asset.customerFirstName && asset.customerLastName
      ? `${asset.customerFirstName} ${asset.customerLastName}`
      : "Unknown Customer";

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-8 w-8"
          >
            <IconArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light">
              <IconDevices2 className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold text-foreground">
                {asset.equipmentType}
                {asset.brand ? ` — ${asset.brand}` : ""}
                {asset.model ? ` ${asset.model}` : ""}
              </h1>
              <p className="text-sm text-muted-foreground font-body">
                {asset.serialNumber
                  ? `S/N: ${asset.serialNumber}`
                  : "No serial number"}
              </p>
            </div>
          </div>
          {warranty && (
            <Badge variant="outline" className={warranty.className}>
              {warranty.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 lg:items-start">
          {/* Left Panel — Info */}
          <div className="w-full lg:w-80 shrink-0 rounded-lg border border-border bg-card shadow-sm p-4 sm:p-5 space-y-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
              Asset Information
            </h3>

            <div className="space-y-3">
              <InfoRow
                icon={<IconUser className="h-3.5 w-3.5 text-brand" />}
                label="Customer"
                value={
                  <Link
                    href={`/customers/${asset.customerId}`}
                    className="text-brand hover:underline"
                  >
                    {customerName}
                  </Link>
                }
              />
              <InfoRow
                icon={<IconDevices2 className="h-3.5 w-3.5 text-brand" />}
                label="Type"
                value={asset.equipmentType}
              />
              {asset.brand && (
                <InfoRow
                  icon={<IconHash className="h-3.5 w-3.5 text-brand" />}
                  label="Brand / Model"
                  value={[asset.brand, asset.model]
                    .filter(Boolean)
                    .join(" ")}
                />
              )}
              {asset.serialNumber && (
                <InfoRow
                  icon={<IconHash className="h-3.5 w-3.5 text-brand" />}
                  label="Serial Number"
                  value={asset.serialNumber}
                />
              )}
              {asset.location && (
                <InfoRow
                  icon={<IconMapPin className="h-3.5 w-3.5 text-brand" />}
                  label="Location"
                  value={asset.location}
                />
              )}
              <InfoRow
                icon={<IconCalendar className="h-3.5 w-3.5 text-brand" />}
                label="Install Date"
                value={formatDate(asset.installDate)}
              />
              <InfoRow
                icon={
                  <IconShieldCheck className="h-3.5 w-3.5 text-brand" />
                }
                label="Warranty Expiry"
                value={formatDate(asset.warrantyExpiry)}
              />
            </div>

            {asset.notes && (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
                  Notes
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {asset.notes}
                </p>
              </>
            )}
          </div>

          {/* Center Panel — Tabs */}
          <div className="flex-1 min-w-0 rounded-lg border border-border bg-card shadow-sm p-4 sm:p-5">
            <Tabs defaultValue="history" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="history">Service History</TabsTrigger>
                <TabsTrigger value="logs">Refrigerant Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="mt-4">
                <AssetServiceHistoryTab equipmentId={asset.id} />
              </TabsContent>
              <TabsContent value="logs" className="mt-4">
                <RefrigerantLogsPanel equipmentId={asset.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-body">{label}</p>
        <p className="text-sm font-medium text-foreground font-body break-words">
          {value}
        </p>
      </div>
    </div>
  );
}
