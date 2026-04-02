import { z } from "zod";

export const quoteLineItemParam = z.object({
  id: z.string().uuid(),
  lineItemId: z.string().uuid(),
});
