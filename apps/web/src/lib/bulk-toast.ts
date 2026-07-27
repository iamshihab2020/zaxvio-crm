import { toast } from "sonner";

/**
 * Renders the outcome of a bulk action honestly.
 *
 * Every bulk endpoint returns `{succeeded, failed, errors}`. Every bulk hook used
 * to render `toast.success(res.message ?? "Customers deleted")` — and no endpoint
 * has ever returned `message`, so the fallback always won and `failed`/`errors`
 * were dropped on the floor. Selecting five customers, having three refused
 * because they still had invoices, produced the word "deleted" and no other
 * signal; the three were simply still in the list afterwards (CUST-03).
 *
 * This is deliberately in the frontend rather than the API. There are 22 such
 * endpoints across 7 domains and none of them reported partial failure, so fixing
 * it where the toast is rendered fixes all of them at once and needs no new
 * server contract. A server-authored `message` is still preferred when present.
 */

export interface BulkActionResult {
  succeeded?: number;
  failed?: number;
  errors?: { id: string; message: string }[];
  message?: string;
  error?: string | null;
}

/**
 * Toast the result of a bulk mutation.
 *
 * - nothing failed → success
 * - some failed → warning naming both counts, with the first distinct reason
 * - everything failed → error
 *
 * `fallback` is the wording used when the server sends no `message` and the
 * counts are unavailable (an older endpoint, or a shape we don't recognise).
 */
export function bulkToast(res: BulkActionResult, fallback: string): void {
  const succeeded = typeof res.succeeded === "number" ? res.succeeded : null;
  const failed = typeof res.failed === "number" ? res.failed : 0;

  // Distinct reasons — a per-id errors array usually repeats the same sentence.
  const reasons = Array.from(
    new Set((res.errors ?? []).map((e) => e.message).filter(Boolean)),
  );
  const detail = reasons.length > 0 ? reasons[0] : undefined;

  if (failed > 0 && succeeded === 0) {
    toast.error(res.message ?? `Nothing was updated — ${failed} could not be processed`, {
      description: detail,
    });
    return;
  }

  if (failed > 0) {
    toast.warning(res.message ?? `${succeeded} updated, ${failed} skipped`, {
      description: detail,
    });
    return;
  }

  toast.success(res.message ?? fallback);
}
