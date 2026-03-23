"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  IconBuilding,
  IconUser,
  IconMail,
  IconPhone,
  IconMapPin,
  IconReceipt,
  IconInfoCircle,
} from "@tabler/icons-react";

interface BusinessSidebarProps {
  tenant: {
    businessName: string;
    ownerName: string;
    email: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    defaultTaxRate: string | null;
  };
}

export function BusinessSidebar({ tenant }: BusinessSidebarProps) {
  const taxDisplay = tenant.defaultTaxRate
    ? `${(parseFloat(tenant.defaultTaxRate) * 100).toFixed(2)}%`
    : "Not set";

  const fullAddress = [tenant.address, tenant.city, tenant.state, tenant.zipCode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-4">
      {/* Quick summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Business Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SummaryRow icon={IconBuilding} label="Business" value={tenant.businessName} />
          <SummaryRow icon={IconUser} label="Owner" value={tenant.ownerName} />
          <SummaryRow icon={IconMail} label="Email" value={tenant.email} />
          <SummaryRow icon={IconPhone} label="Phone" value={tenant.phone || "Not set"} muted={!tenant.phone} />
          <SummaryRow icon={IconMapPin} label="Address" value={fullAddress || "Not set"} muted={!fullAddress} />
          <div className="border-t border-border pt-3">
            <SummaryRow icon={IconReceipt} label="Tax Rate" value={taxDisplay} muted={!tenant.defaultTaxRate} />
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <IconInfoCircle className="h-4 w-4" />
            Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5 text-sm text-muted-foreground font-body list-disc list-inside">
            <li>Set your default tax rate once — it auto-fills on every new job.</li>
            <li>Business name and address appear on invoices and quotes.</li>
            <li>Add a Google Review URL to auto-request reviews after jobs.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-body">{label}</p>
        <p className={`text-sm font-body truncate ${muted ? "text-muted-foreground italic" : "text-foreground"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
