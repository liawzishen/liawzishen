import { Skeleton } from "@/components/ui/Skeleton";

/** Plant-detail skeleton — mirrors the page: header, score card, trend, rows. */
export default function PlantDetailLoading() {
  return (
    <main id="main-content" className="desktop-breakout pb-12 lg:mx-auto lg:w-full lg:max-w-[720px]">
      <div className="h-12" />
      <div className="px-6 pt-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-28" />

        <Skeleton className="mt-5 h-36 w-full" />
        <Skeleton className="mt-4 h-24 w-full" />
        <Skeleton className="mt-4 h-40 w-full" />
        <Skeleton className="mt-4 h-32 w-full" />
      </div>
    </main>
  );
}
