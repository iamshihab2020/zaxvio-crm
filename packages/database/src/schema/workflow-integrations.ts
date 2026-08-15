import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { workflows } from "./workflows";
import { user } from "./auth";

/**
 * P9 — the two tables that let an automation start from outside the CRM.
 *
 * Kept apart from `workflow-events.ts` and `workflow-runs.ts` because both of
 * those describe things the engine *produces*. These two describe things that
 * reach in: a webhook somebody else calls, and a clock.
 */

/**
 * No `hmac`.
 *
 * Verifying an HMAC requires the verifier to hold the key, and `secretHash`
 * below stores a sha256 on purpose. A sender signs with the secret; a hash-only
 * verifier would check against something else. The mode shipped in the first
 * draft and could never have validated a single request — silently and
 * permanently, since every refusal on that endpoint returns the same 404.
 *
 * Outbound signing is unaffected and uses real HMAC: `webhook.send` holds the
 * secret because the author typed it into the node.
 */
export const webhookAuthModeEnum = pgEnum("webhook_auth_mode", ["none", "secret"]);

/**
 * One inbound webhook endpoint.
 *
 * ## The token identifies; the secret authorises
 *
 * `pathToken` appears in the URL. It is unguessable, but it is not a secret —
 * it travels in access logs, in the sending system's config screen, and in
 * whatever chat message somebody pasted it into. Treating a URL segment as
 * authentication is how a "secret URL" ends up in a support ticket.
 *
 * `secretHash` is the authorisation, stored as sha256 and never as plaintext.
 * The secret is shown in full exactly once, at creation. `secretHint` is the
 * last four characters so the UI can say *which* secret this is — a list of
 * endpoints that all say "••••" is a list nobody can act on.
 *
 * ## Globally unique, not per tenant
 *
 * The receiver is public and has no tenant in scope until it has resolved this
 * token. A token unique only within a tenant would make that lookup ambiguous
 * at exactly the moment there is nothing to disambiguate it with.
 */
export const workflowWebhooks = pgTable(
  "workflow_webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),

    pathToken: text("path_token").notNull(),

    authMode: webhookAuthModeEnum("auth_mode").notNull().default("secret"),
    /** sha256 of the secret. Never the secret. */
    secretHash: text("secret_hash"),
    /** Last four characters, so a list of endpoints is distinguishable. */
    secretHint: text("secret_hint"),

    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),

    /**
     * Observability without a second table.
     *
     * "It fired but nothing happened" and "it never fired" are different
     * problems with different fixes, and until something records the arrival
     * they look identical from the automation's side — which is the same gap
     * P8 found in `node_execution_logs` having a writer and no reader.
     */
    lastReceivedAt: timestamp("last_received_at", { withTimezone: true }),
    receivedCount: integer("received_count").notNull().default(0),

    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_workflow_webhooks_token").on(table.pathToken),
    index("idx_workflow_webhooks_workflow").on(table.workflowId),
    index("idx_workflow_webhooks_tenant").on(table.tenantId),
  ],
);

/**
 * What a scheduled sweep has already done.
 *
 * ## "Once only" has to be a row, not a timer
 *
 * The same reasoning as `delay.wait`: a process that remembers is a process
 * that forgets when it restarts, and a deploy at 09:00 would either skip the
 * day's sends or repeat them. A unique index is the memory.
 *
 * ## Why not the outbox's `dedupKey`
 *
 * `workflow_event_queue` already has one, and it would work — for a week. The
 * retention sweep clears that table by design, and a schedule's memory of what
 * it has already sent must outlive the queue row that carried it. A warranty
 * reminder deduped against a queue row deleted after 30 days fires again on
 * day 31.
 */
export const workflowScheduleState = pgTable(
  "workflow_schedule_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Null for a sweep that is about the tenant rather than one automation. */
    workflowId: uuid("workflow_id").references(() => workflows.id, {
      onDelete: "cascade",
    }),

    /**
     * What this row remembers — `schedule.daily:2026-08-15`,
     * `warranty:<equipmentId>`, `contract-visit:<contractId>:2026-09`.
     *
     * The **calendar day is part of the key**, not a comparison against
     * `firedAt`. A timestamp comparison has to decide which day it is in, and
     * the answer differs by tenant timezone; putting the resolved day in the
     * key means the decision is made once, by the code that knows the zone.
     */
    dedupKey: text("dedup_key").notNull(),
    /** Which sweep wrote it, so one can be retired without touching another. */
    kind: text("kind").notNull(),

    firedAt: timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_schedule_state_key").on(table.tenantId, table.dedupKey),
    index("idx_schedule_state_reap").on(table.kind, table.firedAt),
  ],
);
