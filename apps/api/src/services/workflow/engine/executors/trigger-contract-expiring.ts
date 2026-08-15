/**
 * `trigger.contract.expiring`.
 *
 * `renewalReminderSent` is passed through so an automation can decline to be
 * the second thing that says the same sentence — E-09 already emails a renewal
 * reminder, and a business running both would otherwise chase twice.
 */

import type { Executor } from "./types.js";

const triggerContractExpiring: Executor = async ({ ctx }) => ({
  output: {
    contractId: ctx.contract?.id ?? null,
    contractName: ctx.contract?.name ?? null,
    endDate: ctx.contract?.endDate ?? null,
    daysUntilExpiry: ctx.trigger.payload?.daysUntilExpiry ?? null,
    renewalReminderSent: ctx.trigger.payload?.renewalReminderSent ?? false,
    customerId: ctx.customer?.id ?? null,
  },
});

export default triggerContractExpiring;
