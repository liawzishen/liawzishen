import Link from "next/link";

/** Pushed-page header (06 §9): ‹ Back left, centred title, no tab bar. */
export function TopNav({
  title,
  backHref,
  right,
}: {
  title?: string;
  backHref: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur-xl">
      <div className="relative flex h-12 items-center justify-between px-4">
        <Link
          href={backHref}
          className="flex min-w-[44px] items-center gap-0.5 text-[17px] text-brand"
        >
          <span aria-hidden className="text-[24px] leading-none">
            ‹
          </span>
          Back
        </Link>
        {title && (
          <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold">
            {title}
          </span>
        )}
        <div className="min-w-[44px] text-right">{right}</div>
      </div>
    </header>
  );
}
