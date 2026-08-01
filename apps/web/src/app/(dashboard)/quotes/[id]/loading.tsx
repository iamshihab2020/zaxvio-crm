import { DetailPageSkeleton } from "@/components/reusable/detail-page-skeleton";

/**
 * Without this file, `/quotes/[id]` inherits `quotes/loading.tsx` — the *list*
 * page's skeleton — because Next.js applies a segment's loading UI to its
 * children.
 */
export default function Loading() {
  return <DetailPageSkeleton sidebar />;
}
