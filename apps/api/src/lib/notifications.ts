import { publish } from "./event-bus.js";
import {
  getDb,
  notifications,
  notificationDeliveries,
  notificationChannelConfig,
  member,
  user,
  tenants,
  eq,
  and,
} from "@hvac-saas/database";
import { NOTIFICATION_CHANNEL_DEFAULTS } from "@hvac-saas/types";
import type { NotificationType } from "@hvac-saas/types";

interface DispatchParams {
  tenantId: string;
  type: NotificationType;
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  dedupKey?: string;
}

/**
 * Dispatch a notification across all configured channels (in-app, email, SMS, voice).
 * Fire-and-forget — does not throw on failure.
 *
 * 1. Inserts notification row (with dedup)
 * 2. Gets org members for the tenant (excluding actor)
 * 3. For each member, checks channel preferences and delivers accordingly
 */
export function dispatchNotification(params: DispatchParams): void {
  _dispatchAsync(params).catch((err) => {
    console.error("[notifications] dispatch failed:", err);
  });
}

async function _dispatchAsync(params: DispatchParams): Promise<void> {
  const db = getDb();
  const {
    tenantId,
    type,
    title,
    description,
    entityType,
    entityId,
    actorId,
    metadata,
    dedupKey,
  } = params;

  // 1. Insert notification
  const inserted = await db
    .insert(notifications)
    .values({
      tenantId,
      type,
      title,
      description,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      actorId: actorId ?? null,
      metadata: metadata ?? null,
      dedupKey: dedupKey ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });

  if (inserted.length === 0) {
    // Dedup hit — notification already exists
    return;
  }

  const notificationId = inserted[0].id;

  // 2. Get tenant's organizationId
  const tenant = await db
    .select({ organizationId: tenants.organizationId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .then((r) => r[0]);

  if (!tenant?.organizationId) return;

  // 3. Get all org members (excluding the actor)
  const members = await db
    .select({ userId: member.userId })
    .from(member)
    .where(eq(member.organizationId, tenant.organizationId));

  const recipientUserIds = members
    .map((m) => m.userId)
    .filter((uid) => uid !== actorId);

  if (recipientUserIds.length === 0) return;

  // 4. Get channel configs for all recipients
  const configs = await db
    .select()
    .from(notificationChannelConfig)
    .where(
      and(
        eq(notificationChannelConfig.tenantId, tenantId),
        eq(notificationChannelConfig.notificationType, type),
      ),
    );

  const configMap = new Map(
    configs.map((c) => [c.userId, c]),
  );

  const defaults = NOTIFICATION_CHANNEL_DEFAULTS[type] ?? {
    inApp: true,
    email: true,
    sms: false,
    voice: false,
  };

  // 5. Deliver in-app (broadcast once for all recipients)
  const anyoneWantsInApp = recipientUserIds.some((uid) => {
    const cfg = configMap.get(uid);
    return cfg ? cfg.inApp : defaults.inApp;
  });

  if (anyoneWantsInApp) {
    await deliverInApp(notificationId, tenantId, {
      id: notificationId,
      tenantId,
      type,
      title,
      description,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      actorId: actorId ?? null,
      metadata: metadata ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  // Log in-app deliveries
  const inAppDeliveries = recipientUserIds
    .filter((uid) => {
      const cfg = configMap.get(uid);
      return cfg ? cfg.inApp : defaults.inApp;
    })
    .map((uid) => ({
      notificationId,
      channel: "in_app" as const,
      recipientId: uid,
      status: "sent" as const,
    }));

  // 6. Deliver email for each recipient who has email enabled
  const emailRecipients = recipientUserIds.filter((uid) => {
    const cfg = configMap.get(uid);
    return cfg ? cfg.email : defaults.email;
  });

  if (emailRecipients.length > 0) {
    // Get user emails
    const users = await db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(
        // Simple approach: get all users and filter in JS
        // For 1-5 team members this is fine
        eq(user.id, emailRecipients[0]),
      );

    // For multiple recipients, fetch each
    const allUsers =
      emailRecipients.length === 1
        ? users
        : await Promise.all(
            emailRecipients.map((uid) =>
              db
                .select({ id: user.id, email: user.email, name: user.name })
                .from(user)
                .where(eq(user.id, uid))
                .then((r) => r[0]),
            ),
          ).then((results) =>
            results.filter(
              (u): u is NonNullable<typeof u> => u !== undefined,
            ),
          );

    for (const recipient of allUsers) {
      await deliverEmail(
        notificationId,
        type,
        title,
        description,
        entityType,
        entityId,
        metadata,
        recipient,
      );
    }
  }

  const emailDeliveries = emailRecipients.map((uid) => ({
    notificationId,
    channel: "email" as const,
    recipientId: uid,
    status: "sent" as const,
  }));

  // 7. SMS — stub for later
  const smsRecipients = recipientUserIds.filter((uid) => {
    const cfg = configMap.get(uid);
    return cfg ? cfg.sms : defaults.sms;
  });
  if (smsRecipients.length > 0) {
    console.log(
      `[notifications] SMS not configured yet — ${smsRecipients.length} recipient(s) skipped for ${type}`,
    );
  }

  // 8. Voice — stub for later
  const voiceRecipients = recipientUserIds.filter((uid) => {
    const cfg = configMap.get(uid);
    return cfg ? cfg.voice : defaults.voice;
  });
  if (voiceRecipients.length > 0) {
    console.log(
      `[notifications] Voice not configured yet — ${voiceRecipients.length} recipient(s) skipped for ${type}`,
    );
  }

  // 9. Log all deliveries
  const allDeliveries = [...inAppDeliveries, ...emailDeliveries];
  if (allDeliveries.length > 0) {
    await db
      .insert(notificationDeliveries)
      .values(allDeliveries)
      .catch((err) => {
        console.error("[notifications] Failed to log deliveries:", err);
      });
  }
}

/** Broadcast notification over SSE */
async function deliverInApp(
  _notificationId: string,
  tenantId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    publish(tenantId, "notifications", "new_notification", payload);
  } catch (err) {
    console.error("[notifications] in-app broadcast failed:", err);
  }
}

/** Send email notification — maps type to existing email templates or generic */
async function deliverEmail(
  _notificationId: string,
  type: NotificationType,
  title: string,
  description: string,
  entityType: string | undefined,
  entityId: string | undefined,
  metadata: Record<string, unknown> | undefined,
  recipient: { id: string; email: string; name: string },
): Promise<void> {
  try {
    // Lazy import to avoid circular deps
    const email = await import("./email.js");
    const frontendUrl =
      process.env.FRONTEND_URL ?? "http://localhost:3000";

    // Build entity link
    const entityLink =
      entityType && entityId
        ? `${frontendUrl}/${entityType === "member" ? "settings/team" : `${entityType}s/${entityId}`}`
        : `${frontendUrl}/dashboard`;

    // Map notification type to existing email templates where available
    switch (type) {
      case "booking_received":
        // E-03 is already sent directly in booking route — skip to avoid duplicates
        // If user disabled the direct email but has notification email enabled,
        // fall through to generic
        break;

      default:
        // Generic notification email for all types without dedicated templates
        if ("sendNotificationAlertEmail" in email) {
          (
            email as Record<
              string,
              (args: {
                to: string;
                props: {
                  recipientName: string;
                  title: string;
                  description: string;
                  ctaLabel: string;
                  ctaUrl: string;
                };
              }) => Promise<void>
            >
          ).sendNotificationAlertEmail({
            to: recipient.email,
            props: {
              recipientName: recipient.name || "there",
              title,
              description,
              ctaLabel: "View Details",
              ctaUrl: entityLink,
            },
          });
        } else {
          // Generic email template not yet created — log for now
          console.log(
            `[notifications] Email for ${type} to ${recipient.email}: ${title}`,
          );
        }
        break;
    }
  } catch (err) {
    console.error(
      `[notifications] email delivery failed for ${recipient.email}:`,
      err,
    );
  }
}
