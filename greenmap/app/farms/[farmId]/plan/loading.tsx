import { Skeleton } from "@/components/ui/Skeleton";

export default function PlanLoading() {
  return (
    <main className="desktop-breakout px-5 pb-12 pt-16 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <Skeleton className="h-28 w-full rounded-card" />
      <div className="mt-4 space-y-3">
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
      </div>
    </main>
  );
}
