-- Migration: Add conversations and messages tables for the Conversations feature
-- Idempotent: all statements use IF NOT EXISTS / DO $$ guards

-- ── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_channel') THEN
    CREATE TYPE "conversation_channel" AS ENUM ('sms', 'email');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_direction') THEN
    CREATE TYPE "message_direction" AS ENUM ('inbound', 'outbound');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
    CREATE TYPE "message_status" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'received');
  END IF;
END $$;

-- Add message_received to existing notification_type enum (safe no-op if already present)
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'message_received';

-- ── conversations ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "conversations" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"       uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "customer_id"     uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "channel"         "conversation_channel" NOT NULL,
  "subject"         text,
  "status"          text NOT NULL DEFAULT 'active',
  "last_message_at" timestamptz,
  "unread_count"    integer NOT NULL DEFAULT 0,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "updated_at"      timestamptz NOT NULL DEFAULT now()
);

-- ── messages ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "messages" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id"  uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "tenant_id"        uuid NOT NULL,
  "direction"        "message_direction" NOT NULL,
  "channel"          "conversation_channel" NOT NULL,
  "body"             text NOT NULL,
  "subject"          text,
  "status"           "message_status" NOT NULL DEFAULT 'queued',
  "external_id"      text,
  "sender_id"        text,
  "created_at"       timestamptz NOT NULL DEFAULT now()
);

-- ── Indices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "idx_conversations_tenant"
  ON "conversations" ("tenant_id", "last_message_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_conversations_customer"
  ON "conversations" ("tenant_id", "customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_conversations_unique"
  ON "conversations" ("tenant_id", "customer_id", "channel");

CREATE INDEX IF NOT EXISTS "idx_messages_conversation"
  ON "messages" ("conversation_id", "created_at");
