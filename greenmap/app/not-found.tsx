import Link from "next/link";

/** Friendly global 404. */
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"
    >
      <div className="text-[44px]" aria-hidden>🔍</div>
      <h1 className="mt-2 text-[20px] font-bold">Page not found</h1>
      <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-secondary">
        That page doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/farms"
        className="mt-6 rounded-btn bg-brand px-5 py-3 text-[15px] font-semibold text-white active:opacity-80"
      >
        Back to my farms
      </Link>
    </main>
  );
}
