import { Skeleton } from "@/components/ui/Skeleton";

export default function PlanLoading() {
  return (
    <main className="px-5 pb-12 pt-16">
      <Skeleton className="h-28 w-full rounded-card" />
      <div className="mt-4 space-y-3">
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
      </div>
    </main>
  );
}
