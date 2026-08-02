/**
 * Seed a query from what the server already rendered.
 *
 * The recurring defect (INV-15, QUO-14, now ARC-06 on five more pages): a
 * `page.tsx` fetches the list, passes it to the client component, and the
 * client destructures the prop and never references it. Every visit then pays
 * for the same data twice and still renders a skeleton while the second copy
 * loads.
 *
 * Two rules this encodes so each page stops re-deriving them:
 *
 *  - **Seed only the exact key the server rendered.** Seeding every key is the
 *    original dashboard bug — changing a filter showed stale data and never
 *    refetched. Callers pass `match`, which must be true only for the first
 *    render's params.
 *  - **`initialDataUpdatedAt` must be honest.** Without it the seed looks
 *    permanently fresh and the query never revalidates. `Date.now()` at module
 *    evaluation is close enough to "when the server rendered this" for a value
 *    that arrived in the same response.
 */
export function seeded<T>(
  match: boolean,
  data: T | undefined,
): { initialData: T; initialDataUpdatedAt: number } | Record<string, never> {
  if (!match || data === undefined) return {};
  return { initialData: data, initialDataUpdatedAt: Date.now() };
}
