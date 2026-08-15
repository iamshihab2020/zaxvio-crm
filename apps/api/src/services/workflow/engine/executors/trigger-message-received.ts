/**
 * `trigger.message.received`.
 *
 * **The filters are not evaluated here.** They are declared on the definition's
 * properties (`filter: { path, operator }`) and evaluated by the trigger matcher
 * *before* a run is created. Matching at execution time would mean creating a
 * run, loading its context and writing log rows for every record in the tenant,
 * then throwing almost all of them away.
 *
 * By the time this executes the decision is already made, so it only has to hand
 * the next step something to reference.
 *
 * The message body is **not** on the output. `restoreContext` rebuilds from the
 * customer, and a resumed run three days later would re-read whatever the newest
 * message is — which is not the one that started the run. Anything a step needs
 * from the message must be read from the trigger payload, which does not move.
 */

import type { Executor } from "./types.js";

const triggerMessageReceived: Executor = async ({ ctx }) => ({
  output: {
    customerId: ctx.customer?.id ?? null,
    customerName: ctx.customer?.fullName ?? null,
  },
});

export default triggerMessageReceived;
