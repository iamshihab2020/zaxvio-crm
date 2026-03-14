import type { quotes, quoteLineItems } from "@hvac-saas/database";

export type Quote = typeof quotes.$inferSelect;
export type QuoteInsert = typeof quotes.$inferInsert;
export type QuoteUpdate = Partial<QuoteInsert>;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;
