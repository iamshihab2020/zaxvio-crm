import { DetailPageSkeleton } from "@/components/reusable/detail-page-skeleton";

/**
 * Without this file, `/customers/[id]` inherits `customers/loading.tsx` — the *list*
 * page's skeleton — because Next.js applies a segment's loading UI to its
 * children.
 */
export default function Loading() {
  return <DetailPageSkeleton info={false} tabs={5} rows={6} />;
}
