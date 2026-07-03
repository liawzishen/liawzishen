import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Tab-content skeleton. Shown inside the persistent AppShell while a tab
 * page fetches, so switching tabs never blanks the whole screen.
 */
export default function TabLoading() {
  return (
    <main className="px-5 pt-12">
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
