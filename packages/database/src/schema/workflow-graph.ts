import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { workflows } from "./workflows";

/**
 * The **draft** graph — what the builder edits.
 *
 * The engine never reads these tables. It reads the pinned snapshot in
 * `workflow_versions.graph`, which is what keeps an in-flight run safe from
 * someone editing the automation underneath it.
 *
 * Node ids are **client-minted** (`crypto.randomUUID()` in the builder's single
 * node constructor) because the save contract sends the whole graph and the
 * server diffs it by id. That is also why an id survives a publish: a node in
 * v1's snapshot and the live draft row are the same id, so a replay can match a
 * historic node log to a node the user still recognises.
 */

export const workflowNodes = pgTable(
  "workflow_nodes",
  {
    /** Client-minted. No defaultRandom — the diff is by id. */
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),

    /** Matches `NodeDefinition.node` — immutable, e.g. "job.moveStage". */
    nodeType: text("node_type").notNull(),

    /**
     * `{ label, parameters, disabled? }`.
     *
     * Every definition default is seeded into `parameters` at creation by the
     * one node constructor. The UI default and the runtime default must never
     * be two separate declarations — that is how a dropdown ends up showing a
     * pre-selected value it never persisted, leaving the runtime to guess.
     */
    nodeConfig: jsonb("node_config").notNull(),

    positionX: integer("position_x").notNull().default(0),
    positionY: integer("position_y").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_workflow_nodes_workflow").on(table.workflowId),
    index("idx_workflow_nodes_tenant").on(table.tenantId),
    index("idx_workflow_nodes_type").on(table.nodeType),
  ],
);

export const workflowEdges = pgTable(
  "workflow_edges",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),

    /**
     * Plain uuid, no foreign key to `workflow_nodes`.
     *
     * A whole-graph save deletes and re-inserts inside one transaction, and an
     * FK would impose an ordering constraint for no benefit — the graph
     * validator has to check referential sanity anyway, because the published
     * snapshot needs it too.
     */
    sourceNodeId: uuid("source_node_id").notNull(),

    /**
     * A **column**, not a key inside a JSON blob.
     *
     * This is routing logic: it decides which edge a branching node follows,
     * so it must be queryable and indexable. And it stores a *stable id*
     * (`found`), never the display label ("Found") — the system this was ported
     * from stores the label, so renaming a branch breaks routing on every saved
     * automation.
     */
    sourceHandle: text("source_handle").notNull().default("main"),

    targetNodeId: uuid("target_node_id").notNull(),
    /** Optional edge annotation shown on the canvas. Purely cosmetic. */
    label: text("label"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_workflow_edges_workflow").on(table.workflowId),
    index("idx_workflow_edges_source").on(table.sourceNodeId, table.sourceHandle),
    index("idx_workflow_edges_target").on(table.targetNodeId),
    index("idx_workflow_edges_tenant").on(table.tenantId),
  ],
);
