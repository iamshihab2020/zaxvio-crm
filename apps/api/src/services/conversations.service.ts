import { publish } from "../lib/event-bus.js";
import {
  getDb,
  conversations,
  messages,
  customers,
  eq,
  and,
  desc,
  lt,
  sql,
} from "@hvac-saas/database";
import { sendEmail, sanitizeSubject } from "../lib/email.js";
import { dispatchNotification } from "../lib/notifications.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConversationWithCustomer {
  id: string;
  tenantId: string;
  customerId: string;
  channel: "sms" | "email";
  subject: string | null;
  status: string;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string | null;
  customerPhone: string | null;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  tenantId: string;
  direction: "inbound" | "outbound";
  channel: "sms" | "email";
  body: string;
  subject: string | null;
  status: string;
  externalId: string | null;
  senderId: string | null;
  createdAt: string;
}

// ── List conversations ─────────────────────────────────────────────────────

export async function listConversations(
  tenantId: string,
  params: {
    search?: string;
    page?: number;
    limit?: number;
    channel?: "sms" | "email";
    status?: "active" | "archived";
    customerId?: string;
  },
): Promise<{ data: ConversationWithCustomer[]; total: number }> {
  const db = getDb();
  const page = params.page ?? 1;
  const limit = params.limit ?? 30;
  const offset = (page - 1) * limit;

  const baseWhere = and(
    eq(conversations.tenantId, tenantId),
    params.customerId ? eq(conversations.customerId, params.customerId) : undefined,
    params.channel ? eq(conversations.channel, params.channel) : undefined,
    params.status
      ? eq(conversations.status, params.status)
      : eq(conversations.status, "active"),
  );

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: conversations.id,
        tenantId: conversations.tenantId,
        customerId: conversations.customerId,
        channel: conversations.channel,
        subject: conversations.subject,
        status: conversations.status,
        lastMessageAt: conversations.lastMessageAt,
        unreadCount: conversations.unreadCount,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerEmail: customers.email,
        customerPhone: customers.phone,
      })
      .from(conversations)
      .innerJoin(
        customers,
        and(
          eq(conversations.customerId, customers.id),
          eq(customers.tenantId, tenantId),
        ),
      )
      .where(baseWhere)
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(baseWhere),
  ]);

  return {
    data: rows.map((r) => ({
      ...r,
      lastMessageAt: r.lastMessageAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total: countRows[0]?.count ?? 0,
  };
}

// ── Get or create conversation ─────────────────────────────────────────────

export async function getOrCreateConversation(
  tenantId: string,
  customerId: string,
  channel: "sms" | "email",
  subject?: string,
): Promise<ConversationWithCustomer> {
  const db = getDb();

  // Try to find existing
  const existing = await db
    .select({
      id: conversations.id,
      tenantId: conversations.tenantId,
      customerId: conversations.customerId,
      channel: conversations.channel,
      subject: conversations.subject,
      status: conversations.status,
      lastMessageAt: conversations.lastMessageAt,
      unreadCount: conversations.unreadCount,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerEmail: customers.email,
      customerPhone: customers.phone,
    })
    .from(conversations)
    .innerJoin(
      customers,
      and(
        eq(conversations.customerId, customers.id),
        eq(customers.tenantId, tenantId),
      ),
    )
    .where(
      and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.customerId, customerId),
        eq(conversations.channel, channel),
      ),
    )
    .then((r) => r[0]);

  if (existing) {
    return {
      ...existing,
      lastMessageAt: existing.lastMessageAt?.toISOString() ?? null,
      createdAt: existing.createdAt.toISOString(),
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  // Create new
  const [created] = await db
    .insert(conversations)
    .values({ tenantId, customerId, channel, subject: subject ?? null })
    .returning();

  const customer = await db
    .select({
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      phone: customers.phone,
    })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .then((r) => r[0]);

  return {
    id: created.id,
    tenantId: created.tenantId,
    customerId: created.customerId,
    channel: created.channel,
    subject: created.subject,
    status: created.status,
    lastMessageAt: null,
    unreadCount: 0,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    customerFirstName: customer?.firstName ?? "",
    customerLastName: customer?.lastName ?? "",
    customerEmail: customer?.email ?? null,
    customerPhone: customer?.phone ?? null,
  };
}

// ── List messages ──────────────────────────────────────────────────────────

export async function listMessages(
  tenantId: string,
  conversationId: string,
  params: { limit?: number; cursor?: string },
): Promise<MessageRow[]> {
  const db = getDb();
  const limit = params.limit ?? 50;

  // Verify conversation belongs to tenant
  const conv = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.tenantId, tenantId),
      ),
    )
    .then((r) => r[0]);

  if (!conv) return [];

  const whereClause = and(
    eq(messages.conversationId, conversationId),
    params.cursor
      ? lt(messages.createdAt, new Date(params.cursor))
      : undefined,
  );

  const rows = await db
    .select()
    .from(messages)
    .where(whereClause)
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  // Return in chronological order (oldest first)
  return rows.reverse().map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ── Create message ─────────────────────────────────────────────────────────

export async function createMessage(data: {
  conversationId: string;
  tenantId: string;
  direction: "inbound" | "outbound";
  channel: "sms" | "email";
  body: string;
  subject?: string | null;
  status?: "queued" | "sent" | "delivered" | "failed" | "received";
  externalId?: string | null;
  senderId?: string | null;
}): Promise<MessageRow> {
  const db = getDb();

  const [inserted] = await db
    .insert(messages)
    .values({
      conversationId: data.conversationId,
      tenantId: data.tenantId,
      direction: data.direction,
      channel: data.channel,
      body: data.body,
      subject: data.subject ?? null,
      status: data.status ?? "sent",
      externalId: data.externalId ?? null,
      senderId: data.senderId ?? null,
    })
    .returning();

  // Update conversation lastMessageAt + unreadCount (only for inbound)
  await db
    .update(conversations)
    .set({
      lastMessageAt: inserted.createdAt,
      updatedAt: inserted.createdAt,
      ...(data.direction === "inbound"
        ? { unreadCount: sql`${conversations.unreadCount} + 1` }
        : {}),
    })
    .where(eq(conversations.id, data.conversationId));

  return {
    ...inserted,
    createdAt: inserted.createdAt.toISOString(),
  };
}

// ── Mark conversation read ─────────────────────────────────────────────────

export async function markConversationRead(
  tenantId: string,
  conversationId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({ unreadCount: 0, updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.tenantId, tenantId),
      ),
    );
}

// ── Archive conversation ───────────────────────────────────────────────────

export async function archiveConversation(
  tenantId: string,
  conversationId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({ status: "archived", updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.tenantId, tenantId),
      ),
    );
}

// ── Broadcast new message over SSE ────────────────────────────

export async function broadcastNewMessage(
  tenantId: string,
  conversationId: string,
  message: MessageRow,
): Promise<void> {
  try {
    publish(tenantId, "conversations", "new_message", { conversationId, message });
  } catch (err) {
    console.error("[conversations] Realtime broadcast failed:", err);
  }
}

// ── Send outbound email ────────────────────────────────────────────────────

export async function sendConversationEmail(
  to: string,
  subject: string,
  body: string,
): Promise<string | null> {
  try {
    await sendEmail({
      to,
      subject: sanitizeSubject(subject),
      html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${body.replace(/\n/g, "<br/>")}</div>`,
      tag: "conversation-email",
    });
    return null; // no external ID from Resend (fire-and-forget)
  } catch (err) {
    console.error("[conversations] email send failed:", err);
    return null;
  }
}

// ── Dispatch notification for new inbound message ─────────────────────────

export function notifyNewInboundMessage(
  tenantId: string,
  customerId: string,
  customerName: string,
  messagePreview: string,
): void {
  dispatchNotification({
    tenantId,
    type: "message_received",
    title: `New message from ${customerName}`,
    description:
      messagePreview.length > 100
        ? `${messagePreview.slice(0, 97)}…`
        : messagePreview,
    entityType: "conversation",
    entityId: customerId,
  });
}
