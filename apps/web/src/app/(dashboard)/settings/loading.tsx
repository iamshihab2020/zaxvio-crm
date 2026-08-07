import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense boundary for the whole /settings segment.
 *
 * Six of the twelve settings pages are async server components that await a
 * server action (`getTenant`, `getPipelines`, `getNotificationPreferences`),
 * and every one of those is a Vercel -> Render -> Neon round trip. Without a
 * boundary here Next.js will not commit the client-side navigation until that
 * payload lands, so clicking a sidebar link left the *old* page on screen with
 * the *old* item still highlighted for the duration — the sidebar looked frozen
 * even though it had never unmounted.
 *
 * Every other route under (dashboard) already has one of these; settings was
 * the only segment without.
 *
 * Renders inside `SettingsContent`, which supplies the `p-6` — do not add
 * padding here. The shape mirrors the 2/3 form + 1/3 sidebar grid that
 * business, invoices, quotes and profile all use.
 */
export default function SettingsLoading() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <Skeleton className="mb-2 h-5 w-40" />
          <Skeleton className="mb-6 h-4 w-72" />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <Skeleton className="mb-6 h-5 w-48" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-6 self-start">
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
