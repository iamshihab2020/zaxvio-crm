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

/** Accepts a transaction. `Omit<…, "$client">` is what a Drizzle transaction
 *  satisfies — this repo has typed it as the bare handle three times and been
 *  unable to call the result from inside a transaction each time. */
type Db = Omit<ReturnType<typeof getDb>, "$client">;

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
 * What a dispatch actually did.
 *
 * Returned by `deliverNotification`, ignored by `dispatchNotification`. The
 * distinction matters for the workflow engine: a node log that says `completed`
 * has to be asserting something the node *learned*, and "we handed it to a
 * fire-and-forget function" is not that. Same lesson as DF-NOT-05, where
 * `notification_deliveries` recorded intent instead of outcome and was 100%
 * wrong for the email channel for its entire existence.
 */
export interface NotificationResult {
  /** False for a dedup hit, an unconfigured tenant, or nobody to tell. */
  delivered: boolean;
  notificationId: string | null;
  /** Plain language, for a run log. Never a code. */
  reason: string;
  recipients: number;
  emailsSent: number;
  emailsFailed: number;
}

function nothing(reason: string): NotificationResult {
  return {
    delivered: false,
    notificationId: null,
    reason,
    recipients: 0,
    emailsSent: 0,
    emailsFailed: 0,
  };
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
  _dispatchAsync(params, getDb()).catch((err) => {
    console.error("[notifications] dispatch failed:", err);
  });
}

/**
 * The same dispatch, **awaited**, on a caller-supplied handle.
 *
 * Two things the fire-and-forget version cannot give the workflow engine:
 *
 * 1. **An outcome.** A `notification.internal` node has to write a node log
 *    saying what happened, and it can only do that if it finds out.
 * 2. **The caller's transaction.** `dispatchNotification` opens its own
 *    `getDb()`, so its notification row commits independently of the run that
 *    caused it.
 *
 * Errors still do not escape: a notification that fails must not fail the
 * automation that raised it. They come back as `delivered: false` with the
 * reason, which is exactly what a node log wants to show.
 */
export async function deliverNotification(
  db: Db,
  params: DispatchParams,
): Promise<NotificationResult> {
  try {
    return await _dispatchAsync(params, db);
  } catch (err) {
    return nothing(
      err instanceof Error
        ? `The notification could not be sent: ${err.message}`
        : "The notification could not be sent",
    );
  }
}

async function _dispatchAsync(
  params: DispatchParams,
  db: Db,
): Promise<NotificationResult> {
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
    return nothing("This notification had already been sent");
  }

  const notificationId = inserted[0].id;

  // 2. Get the tenant. Branding travels with the email, so this reads more than
  //    the org id: an alert that arrives with no business name looks like spam
  //    to the person who owns the business.
  const tenant = await db
    .select({
      organizationId: tenants.organizationId,
      businessName: tenants.businessName,
      logoUrl: tenants.logoUrl,
      phone: tenants.phone,
      address: tenants.address,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .then((r) => r[0]);

  if (!tenant?.organizationId) {
    return nothing("This workspace has no organisation, so there is nobody to notify");
  }

  // 3. Get all org members (excluding the actor)
  const members = await db
    .select({ userId: member.userId })
    .from(member)
    .where(eq(member.organizationId, tenant.organizationId));

  const recipientUserIds = members
    .map((m) => m.userId)
    .filter((uid) => uid !== actorId);

  if (recipientUserIds.length === 0) {
    // Not an error. A one-person business acting on their own record is the
    // normal case, and telling them what they just did is noise.
    return nothing("There was nobody to notify besides whoever did it");
  }

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

  const emailDeliveries: {
    notificationId: string;
    channel: "email";
    recipientId: string;
    status: "sent" | "failed";
  }[] = [];

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
      const outcome = await deliverEmail({
        type,
        title,
        description,
        entityType,
        entityId,
        recipient,
        business: {
          name: tenant.businessName,
          logoUrl: tenant.logoUrl,
          phone: tenant.phone,
          address: tenant.address,
        },
      });

      // Record what HAPPENED, not what was intended. Every row here used to be
      // written `sent` regardless — including for the whole period when this
      // path silently logged to the console instead of sending. A delivery log
      // that records intent is worse than no log, because it is the thing you
      // check when a customer says they never got the email.
      if (outcome !== "skipped") {
        emailDeliveries.push({
          notificationId,
          channel: "email" as const,
          recipientId: recipient.id,
          status: outcome,
        });
      }
    }
  }

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

  const emailsSent = emailDeliveries.filter((d) => d.status === "sent").length;
  const emailsFailed = emailDeliveries.filter((d) => d.status === "failed").length;

  return {
    // The in-app bell is the channel that always works. An email that Resend
    // refused does not make the notification undelivered — the recipient still
    // has it — so this is `true` whenever a channel reached someone.
    delivered: inAppDeliveries.length > 0 || emailsSent > 0,
    notificationId,
    reason:
      inAppDeliveries.length > 0 || emailsSent > 0
        ? `Notified ${recipientUserIds.length} team member${recipientUserIds.length === 1 ? "" : "s"}`
        : "Everyone who would have been notified has this notification turned off",
    recipients: recipientUserIds.length,
    emailsSent,
    emailsFailed,
  };
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

/**
 * Where a notification points. `member` is the one entity whose detail page is
 * not `/<entity>s/<id>`.
 */
function entityLink(entityType: string | undefined, entityId: string | undefined): string {
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  if (!entityType || !entityId) return `${frontendUrl}/dashboard`;
  if (entityType === "member") return `${frontendUrl}/settings/team`;
  return `${frontendUrl}/${entityType}s/${entityId}`;
}

/**
 * Send one notification by email.
 *
 * This used to feature-detect its own dependency —
 * `if ("sendNotificationAlertEmail" in email)` — against a function that was
 * exported from nowhere. So every notification type except `booking_received`
 * hit the `else` branch, logged to the server and returned, while the caller
 * went on to write a `notification_deliveries` row saying `status: 'sent'`. The
 * audit trail claimed the email went out; nobody ever received one.
 *
 * It is a direct import now. Still lazy — `email.ts` pulls in Resend and the
 * whole template tree and this module is imported by nearly every route — but
 * lazy and *destructured*, so TypeScript checks the export exists. Remove it and
 * the build breaks, instead of the feature going quiet.
 *
 * See docs/claude/deferred-fixes/notifications.md — DF-NOT-03.
 *
 * `booking_received` is still skipped on purpose: `routes/public/booking.ts`
 * sends E-03 directly with far more detail than a generic alert could carry,
 * and both firing would mean two emails for one booking.
 */
async function deliverEmail(args: {
  type: NotificationType;
  title: string;
  description: string;
  entityType: string | undefined;
  entityId: string | undefined;
  recipient: { id: string; email: string; name: string };
  business: {
    name: string;
    logoUrl: string | null;
    phone: string | null;
    address: string | null;
  };
}): Promise<"sent" | "failed" | "skipped"> {
  const { type, title, description, entityType, entityId, recipient, business } = args;

  if (type === "booking_received") return "skipped";

  try {
    // Lazy import: email.ts pulls in Resend and the whole template tree, and
    // this module is imported by nearly every route.
    const { sendNotificationAlertEmail } = await import("./email.js");

    const outcome = await sendNotificationAlertEmail({
      to: recipient.email,
      props: {
        // A team member, not a customer — so no unsubscribe link. Internal
        // alerts are not marketing, and offering to unsubscribe from "your
        // invoice was paid" is a footgun rather than a courtesy.
        audience: "team",
        recipientName: recipient.name || "there",
        businessName: business.name,
        businessLogoUrl: business.logoUrl,
        businessPhone: business.phone,
        businessAddress: business.address,
        title,
        body: description,
        ctaLabel: "Open in Zaxvio",
        ctaUrl: entityLink(entityType, entityId),
      },
    });

    if (outcome.status === "failed") {
      console.error(
        `[notifications] ${type} to ${recipient.email} was refused: ${outcome.reason}`,
      );
      return "failed";
    }
    // `skipped` means email is not configured — a development state, not a
    // delivery. Recording it as sent is exactly the lie this rewrite removes.
    return outcome.status === "sent" ? "sent" : "skipped";
  } catch (err) {
    console.error(
      `[notifications] email delivery failed for ${recipient.email}:`,
      err,
    );
    return "failed";
  }
}
