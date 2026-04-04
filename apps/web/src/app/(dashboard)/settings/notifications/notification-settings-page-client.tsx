"use client";

import { useState, useEffect } from "react";
import { IconBell } from "@tabler/icons-react";
import { SettingsSection } from "@/components/dashboard/settings/settings-section";
import { SettingsFormMessage } from "@/components/dashboard/settings/settings-form-message";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/actions/notifications";

/** Channel preference defaults when no config row exists */
const NOTIFICATION_CHANNEL_DEFAULTS: Record<
  string,
  { inApp: boolean; email: boolean; sms: boolean; voice: boolean }
> = {
  booking_received: { inApp: true, email: true, sms: false, voice: false },
  job_status_changed: { inApp: true, email: true, sms: false, voice: false },
  invoice_paid: { inApp: true, email: true, sms: false, voice: false },
  customer_created: { inApp: true, email: false, sms: false, voice: false },
  quote_accepted: { inApp: true, email: true, sms: false, voice: false },
  quote_declined: { inApp: true, email: true, sms: false, voice: false },
  invoice_overdue: { inApp: true, email: true, sms: false, voice: false },
  team_member_joined: { inApp: true, email: false, sms: false, voice: false },
};

const NOTIFICATION_TYPES = [
  { type: "booking_received", label: "New Booking" },
  { type: "job_status_changed", label: "Job Status Changed" },
  { type: "invoice_paid", label: "Invoice Paid" },
  { type: "customer_created", label: "Customer Created" },
  { type: "quote_accepted", label: "Quote Accepted" },
  { type: "quote_declined", label: "Quote Declined" },
  { type: "invoice_overdue", label: "Invoice Overdue" },
  { type: "team_member_joined", label: "Team Member Joined" },
] as const;

interface ChannelConfig {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  voice: boolean;
}

interface NotificationSettingsPageClientProps {
  initialPreferences?: Array<{ notificationType: string; inApp: boolean; email: boolean; sms: boolean; voice: boolean }>;
}

export function NotificationSettingsPageClient({ initialPreferences }: NotificationSettingsPageClientProps) {
  const [preferences, setPreferences] = useState<
    Record<string, ChannelConfig>
  >(() => {
    if (initialPreferences && initialPreferences.length > 0) {
      const map: Record<string, ChannelConfig> = {};
      for (const nt of NOTIFICATION_TYPES) {
        const saved = initialPreferences.find((d) => d.notificationType === nt.type);
        const defaults = NOTIFICATION_CHANNEL_DEFAULTS[nt.type] ?? { inApp: true, email: true, sms: false, voice: false };
        map[nt.type] = {
          inApp: saved?.inApp ?? defaults.inApp,
          email: saved?.email ?? defaults.email,
          sms: saved?.sms ?? defaults.sms,
          voice: saved?.voice ?? defaults.voice,
        };
      }
      return map;
    }
    return {};
  });
  const [isLoading, setIsLoading] = useState(!initialPreferences || initialPreferences.length === 0);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (initialPreferences && initialPreferences.length > 0) return;
    async function load() {
      const { data } = await getNotificationPreferences();

      const map: Record<string, ChannelConfig> = {};
      for (const nt of NOTIFICATION_TYPES) {
        const saved = data?.find(
          (d: { notificationType: string }) =>
            d.notificationType === nt.type,
        );
        const defaults = NOTIFICATION_CHANNEL_DEFAULTS[nt.type] ?? {
          inApp: true,
          email: true,
          sms: false,
          voice: false,
        };
        map[nt.type] = saved
          ? {
              inApp: saved.inApp,
              email: saved.email,
              sms: saved.sms,
              voice: saved.voice,
            }
          : defaults;
      }
      setPreferences(map);
      setIsLoading(false);
    }

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = (
    type: string,
    channel: keyof ChannelConfig,
    checked: boolean,
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [type]: { ...prev[type], [channel]: checked },
    }));
    setMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    const prefs = NOTIFICATION_TYPES.map((nt) => ({
      type: nt.type,
      ...preferences[nt.type],
    }));

    const { error } = await updateNotificationPreferences(prefs);

    if (error) {
      setMessage({ type: "error", text: error });
    } else {
      setMessage({ type: "success", text: "Preferences saved" });
    }
    setIsSaving(false);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <SettingsSection
          icon={IconBell}
          title="Notification Preferences"
          description="Choose how you want to be notified for each event type."
        >
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px] font-body">
                        Event
                      </TableHead>
                      <TableHead className="text-center font-body">
                        <Label className="text-xs">In-App</Label>
                      </TableHead>
                      <TableHead className="text-center font-body">
                        <Label className="text-xs">Email</Label>
                      </TableHead>
                      <TableHead className="text-center font-body">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Label className="cursor-help text-xs text-muted-foreground">
                              SMS
                            </Label>
                          </TooltipTrigger>
                          <TooltipContent>
                            Coming soon — available when SMS is configured
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center font-body">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Label className="cursor-help text-xs text-muted-foreground">
                              Voice
                            </Label>
                          </TooltipTrigger>
                          <TooltipContent>
                            Coming soon — available when Voice is configured
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {NOTIFICATION_TYPES.map((nt) => {
                      const config = preferences[nt.type];
                      if (!config) return null;

                      return (
                        <TableRow key={nt.type}>
                          <TableCell className="font-body text-sm font-medium">
                            {nt.label}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={config.inApp}
                              onCheckedChange={(checked) =>
                                handleToggle(nt.type, "inApp", checked)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={config.email}
                              onCheckedChange={(checked) =>
                                handleToggle(nt.type, "email", checked)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Switch
                                    checked={false}
                                    disabled
                                    className="opacity-40"
                                  />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Coming soon</TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Switch
                                    checked={false}
                                    disabled
                                    className="opacity-40"
                                  />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Coming soon</TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <SettingsFormMessage message={message} />

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  {isSaving ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </>
          )}
        </SettingsSection>
      </div>
    </TooltipProvider>
  );
}
