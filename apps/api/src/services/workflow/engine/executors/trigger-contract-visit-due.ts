/**
 * `trigger.contract.visitDue`.
 *
 * `visitNumber` lets a message say "your second of four tune-ups is due"
 * without the automation counting anything — which it could not do anyway,
 * since the visit schedule is derived from the agreement rather than stored.
 */

import type { Executor } from "./types.js";

const triggerContractVisitDue: Executor = async ({ ctx }) => ({
  output: {
    contractId: ctx.contract?.id ?? null,
    contractName: ctx.contract?.name ?? null,
    dueDate: ctx.trigger.payload?.dueDate ?? null,
    visitNumber: ctx.trigger.payload?.visitNumber ?? null,
    visitsPerYear: ctx.contract?.visitsPerYear ?? null,
    customerId: ctx.customer?.id ?? null,
  },
});

export default triggerContractVisitDue;
