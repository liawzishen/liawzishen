import { Skeleton } from "@/components/ui/Skeleton";

/**
 * App-wide loading skeleton, shown while a page's data loads. Pages that are
 * opened often have their own loading.tsx next to them (same idea, closer
 * shape); this one covers the rest.
 *
 * Keep a loading.tsx at or above every page. It is not only cosmetic: in a
 * production build, a page with a long server-rendered list (for example the
 * Scan tab with 40+ plants) never finished loading when it was opened by a
 * link and had no loading boundary of its own (Next 15.5 / React 19.2,
 * found by test on 2026-11-14).
 */
export default function Loading() {
  return (
    <main data-skeleton className="px-5 pt-12">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2 h-7 w-44" />
      <Skeleton className="mt-1.5 h-4 w-28" />

      <div className="mt-5 grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px]" />
        ))}
      </div>

      <Skeleton className="mt-6 h-44 w-full" />
      <Skeleton className="mt-4 h-44 w-full" />
    </main>
  );
}
