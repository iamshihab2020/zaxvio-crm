/**
 * `trigger.equipment.warrantyExpiring`.
 *
 * `daysUntilExpiry` comes off the **trigger payload**, not from the context.
 * `restoreContext` re-reads the equipment row, so a resumed run would recompute
 * a different number of days — and a message saying "your warranty expires in
 * 60 days" sent after a three-day wait would be wrong by exactly that wait.
 */

import type { Executor } from "./types.js";

const triggerEquipmentWarrantyExpiring: Executor = async ({ ctx }) => ({
  output: {
    equipmentId: ctx.equipment?.id ?? null,
    equipmentType: ctx.equipment?.type ?? null,
    warrantyExpiresAt: ctx.equipment?.warrantyExpiresAt ?? null,
    daysUntilExpiry: ctx.trigger.payload?.daysUntilExpiry ?? null,
    customerId: ctx.customer?.id ?? null,
  },
});

export default triggerEquipmentWarrantyExpiring;
