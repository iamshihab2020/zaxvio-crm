"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  IconDevices2,
  IconFileCheck,
  IconShieldCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getEquipment } from "@/actions/equipment";
import { getMaintenanceContracts } from "@/actions/maintenance-contracts";

interface CustomerSidebarPanelProps {
  customerId: string;
}

interface AssetSummary {
  id: string;
  equipmentType: string;
  brand: string | null;
  model: string | null;
  warrantyExpiry: string | null;
}

interface AgreementSummary {
  id: string;
  contractName: string;
  endDate: string;
  isActive: boolean | null;
  frequency: string | null;
}

function getWarrantyInfo(warrantyExpiry: string | null) {
  if (!warrantyExpiry) return null;
  const days = Math.ceil(
    (new Date(warrantyExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return { label: "Expired", color: "text-destructive" };
  if (days <= 90)
    return { label: `${days}d left`, color: "text-amber-600 dark:text-amber-400" };
  return { label: "Active", color: "text-green-600 dark:text-green-400" };
}

function getAgreementStatus(endDate: string, isActive: boolean | null) {
  if (!isActive) return { label: "Inactive", className: "bg-gray-50 text-gray-700 dark:bg-gray-950/40 dark:text-gray-300" };
  const days = Math.ceil(
    (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return { label: "Expired", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" };
  if (days <= 30) return { label: "Expiring", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" };
  return { label: "Active", className: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300" };
}

export function CustomerSidebarPanel({ customerId }: CustomerSidebarPanelProps) {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [agreements, setAgreements] = useState<AgreementSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [assetRes, agreementRes] = await Promise.all([
      getEquipment({ customerId, limit: 5 }),
      getMaintenanceContracts({ customerId, limit: 5 }),
    ]);
    if (assetRes.data) setAssets(assetRes.data as AssetSummary[]);
    if (agreementRes.data) setAgreements(agreementRes.data as AgreementSummary[]);
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="p-4 sm:p-5 space-y-5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Assets summary */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
          Assets ({assets.length})
        </h3>
        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-6">
            <IconDevices2 className="h-5 w-5 text-muted-foreground mb-1.5" />
            <p className="text-xs text-muted-foreground">No assets yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {assets.map((asset) => {
              const warranty = getWarrantyInfo(asset.warrantyExpiry);
              return (
                <Link
                  key={asset.id}
                  href={`/assets/${asset.id}`}
                  className="flex items-start gap-2.5 rounded-md bg-muted/50 px-3 py-2 hover:bg-muted transition-colors cursor-pointer"
                >
                  <IconDevices2 className="h-4 w-4 text-brand mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground font-body truncate">
                      {asset.equipmentType}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[asset.brand, asset.model].filter(Boolean).join(" ") || "—"}
                    </p>
                  </div>
                  {warranty && (
                    <span className="shrink-0">
                      {warranty.label === "Expired" ? (
                        <IconAlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <IconShieldCheck className={`h-3.5 w-3.5 ${warranty.color}`} />
                      )}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Agreements summary */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
          Agreements ({agreements.length})
        </h3>
        {agreements.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-6">
            <IconFileCheck className="h-5 w-5 text-muted-foreground mb-1.5" />
            <p className="text-xs text-muted-foreground">No agreements yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {agreements.map((agreement) => {
              const status = getAgreementStatus(agreement.endDate, agreement.isActive);
              return (
                <div
                  key={agreement.id}
                  className="flex items-start gap-2.5 rounded-md bg-muted/50 px-3 py-2"
                >
                  <IconFileCheck className="h-4 w-4 text-brand mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground font-body truncate">
                      {agreement.contractName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ends {new Date(agreement.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${status.className}`}>
                    {status.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
