import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main id="main-content" className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center px-5 pt-12">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-6 h-72 w-full" />
      <Skeleton className="mt-6 h-40 w-full" />
      <Skeleton className="mt-6 h-44 w-44 rounded-card" />
    </main>
  );
}
