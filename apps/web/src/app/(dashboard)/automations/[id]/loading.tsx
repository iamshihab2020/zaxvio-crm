import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense boundary for the builder.
 *
 * `page.tsx` awaits the graph, and Next will not commit the navigation until
 * that payload lands — so without this file, opening an automation leaves the
 * list on screen with no sign anything happened.
 *
 * Mirrors the real layout (toolbar strip, then a full-bleed canvas) so the
 * transition does not jump when the page arrives. On a phone the toolbar is a
 * back button, the name and three icon buttons, so that is what is drawn: the
 * desktop strip's 450px of wide blocks would otherwise be squeezed into 343.
 */
export default function BuilderLoading() {
  return (
    <section data-fills-viewport className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <Skeleton className="h-10 w-10 sm:h-8 sm:w-32" />
        <Skeleton className="h-5 w-32 sm:w-40" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-10 w-10 sm:h-8 sm:w-24" />
          <Skeleton className="h-10 w-10 sm:h-8 sm:w-20" />
          <Skeleton className="h-10 w-10 sm:h-8 sm:w-24" />
        </div>
      </div>
      <Skeleton className="min-h-0 flex-1 rounded-none" />
    </section>
  );
}
