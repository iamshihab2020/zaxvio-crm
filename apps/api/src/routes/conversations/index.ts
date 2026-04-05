import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { idParam } from "../../lib/schemas/common.js";
import {
  createConversationBody,
  sendMessageBody,
  conversationsQuery,
  messagesQuery,
  patchConversationBody,
} from "../../lib/schemas/conversations.js";
import {
  listConversations,
  getOrCreateConversation,
  listMessages,
  createMessage,
  markConversationRead,
  archiveConversation,
  broadcastNewMessage,
  sendConversationEmail,
} from "../../services/conversations.service.js";
import {
  getDb,
  conversations,
  customers,
  eq,
  and,
} from "@hvac-saas/database";

const conversationRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /conversations
   * List all conversations for the tenant.
   */
  fastify.get(
    "/",
    {
      preHandler: [requireTenant],
      schema: { querystring: conversationsQuery },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { search, page, limit, channel, status, customerId } = request.query;

      const result = await listConversations(tenantId, {
        search,
        page,
        limit,
        channel,
        status,
        customerId,
      });

      return reply.send({
        data: result.data,
        pagination: {
          total: result.total,
          page: page ?? 1,
          limit: limit ?? 30,
        },
      });
    },
  );

  /**
   * POST /conversations
   * Get or create a conversation with a customer on a given channel.
   */
  fastify.post(
    "/",
    {
      preHandler: [requireTenant],
      schema: { body: createConversationBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { customerId, channel, subject } = request.body;

      const conversation = await getOrCreateConversation(
        tenantId,
        customerId,
        channel,
        subject,
      );

      return reply.status(200).send({ data: conversation });
    },
  );

  /**
   * GET /conversations/:id/messages
   * List messages in a conversation (cursor-based pagination, newest-first cursor).
   */
  fastify.get(
    "/:id/messages",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, querystring: messagesQuery },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params;
      const { limit, cursor } = request.query;

      const msgs = await listMessages(tenantId, id, { limit, cursor });

      return reply.send({ data: msgs });
    },
  );

  /**
   * POST /conversations/:id/messages
   * Send a message in a conversation.
   * SMS returns 501 (Coming Soon).
   */
  fastify.post(
    "/:id/messages",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: sendMessageBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const { id: conversationId } = request.params;
      const { body: messageBody, subject } = request.body;

      // Verify conversation belongs to this tenant and get customer email
      const db = getDb();

      const conv = await db
        .select({
          id: conversations.id,
          channel: conversations.channel,
          subject: conversations.subject,
          customerId: conversations.customerId,
          customerEmail: customers.email,
          customerFirstName: customers.firstName,
          customerLastName: customers.lastName,
        })
        .from(conversations)
        .innerJoin(customers, eq(conversations.customerId, customers.id))
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.tenantId, tenantId),
          ),
        )
        .then((r) => r[0]);

      if (!conv) {
        return reply.status(404).send({ error: "Conversation not found" });
      }

      // SMS is a placeholder — not yet implemented
      if (conv.channel === "sms") {
        return reply
          .status(501)
          .send({ error: "SMS messaging is coming soon" });
      }

      // Send email via Resend
      const emailSubject =
        subject ?? conv.subject ?? `Message from your service team`;
      const toEmail = conv.customerEmail;

      if (!toEmail) {
        return reply
          .status(422)
          .send({ error: "Customer has no email address" });
      }

      await sendConversationEmail(toEmail, emailSubject, messageBody);

      // Persist message
      const message = await createMessage({
        conversationId,
        tenantId,
        direction: "outbound",
        channel: conv.channel,
        body: messageBody,
        subject: emailSubject,
        status: "sent",
        senderId: userId,
      });

      // Broadcast via Supabase Realtime (fire-and-forget)
      void broadcastNewMessage(tenantId, conversationId, message);

      return reply.status(201).send({ data: message });
    },
  );

  /**
   * PATCH /conversations/:id
   * Mark a conversation as read or archive it.
   */
  fastify.patch(
    "/:id",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: patchConversationBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params;
      const { action } = request.body;

      if (action === "read") {
        await markConversationRead(tenantId, id);
      } else {
        await archiveConversation(tenantId, id);
      }

      return reply.status(200).send({ success: true });
    },
  );
};

export default conversationRoutes;
