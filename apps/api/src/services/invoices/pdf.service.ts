/**
 * Assembling and storing an invoice PDF.
 *
 * The route file did this twice — once in `POST /:id/send` and once in
 * `GET /:id/pdf` — with the same three-way `Promise.all`, the same dynamic
 * import and slightly different data. One copy now, so the document a customer
 * receives by email and the one they download are provably the same document.
 */

import {
  getDb,
  invoices,
  invoiceLineItems,
  customers,
  tenants,
  and,
  eq,
  asc,
} from "@hvac-saas/database";
import { uploadFile } from "../../lib/storage.js";
import { withSafeLogo } from "../../lib/pdf/logo.js";

type Db = ReturnType<typeof getDb>;

export interface InvoicePdfBundle {
  invoice: typeof invoices.$inferSelect;
  lineItems: (typeof invoiceLineItems.$inferSelect)[];
  customer: typeof customers.$inferSelect | null;
  tenant: typeof tenants.$inferSelect | null;
}

/** Everything the PDF renders, in one round trip. */
export async function loadPdfBundle(
  db: Db,
  params: { tenantId: string; invoice: typeof invoices.$inferSelect },
): Promise<InvoicePdfBundle> {
  const { tenantId, invoice } = params;

  const [lineItems, customer, tenant] = await Promise.all([
    db
      .select()
      .from(invoiceLineItems)
      .where(
        and(
          eq(invoiceLineItems.tenantId, tenantId),
          eq(invoiceLineItems.invoiceId, invoice.id),
        ),
      )
      .orderBy(asc(invoiceLineItems.sortOrder)),
    db
      .select()
      .from(customers)
      .where(
        and(eq(customers.id, invoice.customerId), eq(customers.tenantId, tenantId)),
      )
      .then((r) => r[0] ?? null),
    db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .then((r) => r[0] ?? null),
  ]);

  return { invoice, lineItems, customer, tenant };
}

/**
 * Render the bundle to a PDF buffer.
 *
 * `withSafeLogo` is applied here rather than in the component so no future
 * caller can render the document without it (INV-05).
 */
export async function renderInvoicePdf(
  bundle: InvoicePdfBundle,
  tenantId: string,
): Promise<Buffer> {
  const { generateInvoicePdf } = await import(
    "../../lib/pdf/generate-invoice-pdf.js"
  );
  return generateInvoicePdf(
    bundle.invoice,
    bundle.lineItems,
    bundle.customer,
    withSafeLogo(bundle.tenant, tenantId),
  );
}

/** Where a tenant's invoice PDFs live in the private bucket. */
export function pdfStoragePath(tenantId: string, invoiceId: string): string {
  return `${tenantId}/${invoiceId}.pdf`;
}

/** Render and persist, returning the stored path. */
export async function storeInvoicePdf(
  bundle: InvoicePdfBundle,
  tenantId: string,
): Promise<{ buffer: Buffer; storagePath: string }> {
  const buffer = await renderInvoicePdf(bundle, tenantId);
  const storagePath = pdfStoragePath(tenantId, bundle.invoice.id);
  await uploadFile("invoices", storagePath, buffer, "application/pdf");
  return { buffer, storagePath };
}

/**
 * A filename safe to interpolate into a `Content-Disposition` header.
 *
 * `inline; filename="${inv.invoiceNumber}.pdf"` interpolated a database value
 * into a header with no escaping. Invoice numbers are trigger-generated today
 * so it is not currently reachable, but it is the same class as the
 * `sanitizeSubject` rule ([[security-rules]] §6) and costs one function
 * (INV-41).
 */
export function contentDisposition(invoiceNumber: string | null): string {
  const safe = (invoiceNumber ?? "invoice")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .slice(0, 80);
  return `inline; filename="${safe || "invoice"}.pdf"`;
}
