"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  IconUser,
  IconMail,
  IconShieldCheck,
  IconInfoCircle,
} from "@tabler/icons-react";

interface ProfileSidebarProps {
  user: {
    name: string;
    email: string;
    emailVerified: boolean;
  };
}

export function ProfileSidebar({ user }: ProfileSidebarProps) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-4">
      {/* Profile summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Profile Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand font-heading text-sm font-bold shrink-0">
              {initials}
            </div>
            <p className="text-sm font-medium text-foreground font-body truncate">
              {user.name}
            </p>
          </div>
          <div className="space-y-3">
            <SummaryRow icon={IconUser} label="Name" value={user.name} />
            <SummaryRow icon={IconMail} label="Email" value={user.email} />
            <div className="border-t border-border pt-3">
              <SummaryRow
                icon={IconShieldCheck}
                label="Email Status"
                value={user.emailVerified ? "Verified" : "Unverified"}
                muted={!user.emailVerified}
              />
            </div>
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
            <li>Your name appears on jobs, invoices, and customer communications.</li>
            <li>Changing your email will require re-verification.</li>
            <li>Use a strong, unique password to keep your account secure.</li>
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
