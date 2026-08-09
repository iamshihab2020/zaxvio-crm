/**
 * `customer.addNote` — leave a note on the customer.
 *
 * Writes `customer_notes` **and** a `customer_activities` row, exactly as
 * `POST /customers/:id/notes` does. Two rows rather than one because they answer
 * different questions: the note is content a person reads on the Notes tab, and
 * the activity is the timeline entry that says something happened. A node that
 * wrote only the note would leave the customer's history silent about it.
 *
 * This is the node A-1 was for. `customer_notes.created_by` was `NOT NULL` and
 * FK'd to `user`, and an automation has no user — so this could not write a row
 * at all. It is nullable now, with `created_by_workflow_id` beside it, because
 * a note with no author reads as data loss rather than as attribution.
 *
 * `sideEffect: idempotent` is deliberately **not** claimed: running it twice
 * leaves two notes, which is visible. It is `at-most-once` on the definition.
 */

import { customerActivities, customerNotes } from "@hvac-saas/database";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

/** Matches the route's ceiling. A note is a note, not a document store. */
const MAX_LENGTH = 5000;

const customerAddNote: Executor = async ({ db, ctx, params, node }) => {
  if (!ctx.customer) {
    return {
      skipped:
        "This automation isn't running for a customer, so there was nowhere to put the note.",
    };
  }

  const raw = typeof params.content === "string" ? params.content.trim() : "";
  if (!raw) {
    throw new NodeFailure(
      "Note node has no content",
      `The "${node.label}" step had nothing to write. This usually means every variable in it came out blank — check the step's text against what this automation's trigger provides.`,
    );
  }

  const content = raw.length > MAX_LENGTH ? `${raw.slice(0, MAX_LENGTH - 1)}…` : raw;

  const [note] = await db
    .insert(customerNotes)
    .values({
      tenantId: ctx.tenantId,
      customerId: ctx.customer.id,
      content,
      // No user wrote this. The pair is exclusive: a person or an automation.
      createdBy: null,
      createdByWorkflowId: ctx.workflowId,
    })
    .returning({ id: customerNotes.id });

  await db.insert(customerActivities).values({
    tenantId: ctx.tenantId,
    customerId: ctx.customer.id,
    type: "note.added",
    description: `Note added by "${ctx.workflowName}"`,
    metadata: {
      noteId: note.id,
      workflowId: ctx.workflowId,
      executionId: ctx.executionId,
    },
    // Already nullable, which is why only the notes table needed a migration.
    performedBy: null,
  });

  return { output: { noteId: note.id, truncated: raw.length > MAX_LENGTH } };
};

export default customerAddNote;
