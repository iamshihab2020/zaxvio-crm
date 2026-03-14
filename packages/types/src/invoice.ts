import type {
  invoices,
  invoiceLineItems,
  invoicePayments,
} from "@hvac-saas/database";

export type Invoice = typeof invoices.$inferSelect;
export type InvoiceInsert = typeof invoices.$inferInsert;
export type InvoiceUpdate = Partial<InvoiceInsert>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
