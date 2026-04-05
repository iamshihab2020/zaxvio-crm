import { z } from "zod";
import { paginationQuery } from "./common.js";

export const createConversationBody = z.object({
  customerId: z.string().uuid(),
  channel: z.enum(["sms", "email"]),
  subject: z.string().max(200).optional(),
});

export const sendMessageBody = z.object({
  body: z.string().min(1).max(5000),
  subject: z.string().max(200).optional(),
});

export const conversationsQuery = paginationQuery.extend({
  channel: z.enum(["sms", "email"]).optional(),
  status: z.enum(["active", "archived"]).optional(),
  customerId: z.string().uuid().optional(),
});

export const messagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(), // ISO timestamp — load messages older than this
});

export const patchConversationBody = z.object({
  action: z.enum(["read", "archive"]),
});
