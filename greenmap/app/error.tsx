"use client";

import { useEffect } from "react";
import Link from "next/link";

/** App-level error boundary — keeps any failure from becoming a dead end. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"
    >
      <div className="text-[44px]" aria-hidden>🌧️</div>
      <h1 className="mt-2 text-[20px] font-bold">Something went wrong</h1>
      <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-secondary">
        An unexpected error occurred. Try again — if it keeps happening, head
        back to your farms.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-btn bg-brand px-5 py-3 text-[15px] font-semibold text-white active:opacity-80"
        >
          Try again
        </button>
        <Link
          href="/farms"
          className="rounded-btn bg-fill px-5 py-3 text-[15px] font-semibold text-label active:opacity-80"
        >
          My Farms
        </Link>
      </div>
    </main>
  );
}
