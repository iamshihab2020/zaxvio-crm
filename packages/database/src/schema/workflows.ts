import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { user } from "./auth";

/**
 * Automations — the workflow record, its published versions, and folders.
 *
 * The product calls these "Automations"; the schema and the code call them
 * workflows. Deliberate, not an accident: users of service software recognise
 * "automation", while "workflow" in this product would collide with the *job
 * pipeline*, which is the thing contractors already call their workflow.
 *
 * Design notes live in docs/workflow-automation/wf-03-data-model.md.
 */

export const workflowFolders = pgTable(
  "workflow_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_workflow_folders_tenant").on(table.tenantId)],
);

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),

    /**
     * The on/off switch — and it defaults to **false**.
     *
     * The system this was ported from defaults to true. A drawing tool that
     * starts emailing customers the moment you drop a trigger onto the canvas
     * is a bad idea. The cost is that users build an automation, never activate
     * it, and report it as broken; the fix for that is an unmissable banner in
     * the builder, not a dangerous default.
     */
    isActive: boolean("is_active").notNull().default(false),

    /**
     * The version triggers actually run. NULL until the first publish, which is
     * what stops a half-drawn automation from firing.
     *
     * Not declared as a foreign key in Drizzle: workflows and workflow_versions
     * reference each other, and expressing the cycle here buys nothing the
     * application does not already guarantee. The migration adds the constraint
     * with ON DELETE SET NULL.
     */
    activeVersionId: uuid("active_version_id"),

    folderId: uuid("folder_id").references(
      (): AnyPgColumn => workflowFolders.id,
      { onDelete: "set null" },
    ),

    /**
     * 'tenant' resolves `tenants.timezone`; 'custom' uses the column below.
     *
     * This matters more than it looks. Schedule triggers, delay resolution and
     * every rendered date resolve through here, and a datetime that falls back
     * to the server zone is the most damaging class of automation bug there is
     * — a reminder in the wrong timezone is a missed appointment.
     */
    timezoneMode: text("timezone_mode").notNull().default("tenant"),
    timezone: text("timezone"),

    /** Which launch template this came from, so the gallery can say "installed". */
    templateKey: text("template_key"),

    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Also the optimistic-concurrency token for the whole-graph save. */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_workflows_tenant_active").on(table.tenantId, table.isActive),
    index("idx_workflows_tenant_archived").on(table.tenantId, table.archivedAt),
    index("idx_workflows_folder").on(table.folderId),
  ],
);

/**
 * A published, immutable snapshot of the graph.
 *
 * This is what makes editing a live automation safe. `workflow_nodes` and
 * `workflow_edges` are the *draft* — what the builder edits. Publishing
 * serialises the draft into `graph` here, and a run pins the version it started
 * on, so a delay that paused for three days resumes against the graph it began
 * with rather than one that may no longer contain its next node.
 *
 * A snapshot rather than versioned node rows because node rows must stay
 * editable and singular for the builder to patch one node, and because
 * `node_execution_logs` has to keep pointing at a node id that no longer
 * exists. One column, one write, and "restore v2" becomes a copy.
 */
export const workflowVersions = pgTable(
  "workflow_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),

    /** Monotonic per workflow. Displayed as "v3". */
    version: integer("version").notNull(),

    /** `{ nodes: [...], edges: [...] }`, exactly as the engine reads it. */
    graph: jsonb("graph").notNull(),

    /**
     * Denormalised from the graph so the trigger matcher can find candidate
     * workflows with an index rather than by parsing every snapshot. This query
     * runs on every dispatched event, so it is the hottest read in the feature.
     */
    triggerTypes: text("trigger_types")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    nodeCount: integer("node_count").notNull().default(0),

    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedBy: text("published_by").references(() => user.id, {
      onDelete: "set null",
    }),
    /** What changed, in the publisher's words. Shown in version history. */
    note: text("note"),
  },
  (table) => [
    uniqueIndex("idx_workflow_versions_unique").on(
      table.workflowId,
      table.version,
    ),
    index("idx_workflow_versions_workflow").on(
      table.workflowId,
      table.publishedAt,
    ),
    index("idx_workflow_versions_tenant").on(table.tenantId),
  ],
);
