"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/LanguageProvider";

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
  // Client component purely so the Back label can be translated — it was the
  // one string in the shell still hardcoded English while the tab bars,
  // rendered right beside it, spoke the user's language.
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-20 glass-strong hairline-b">
      <div className="relative flex h-12 items-center justify-between px-4">
        <Link
          href={backHref}
          // brand-dark, not brand: this label sits on glass-strong, where
          // plain --color-brand measures 4.46:1 — just under the 4.5:1 floor.
          className="flex min-w-[44px] items-center gap-0.5 text-[17px] text-brand-dark transition-opacity active:opacity-60"
        >
          <span aria-hidden className="text-[24px] leading-none">
            ‹
          </span>
          {t.common.back}
        </Link>
        {title && (
          /*
            The visible page title has to exist in the heading outline too —
            as a <span> it was announced as plain text and skipped by every
            "list headings" shortcut. Same visual: 17px semibold, absolutely
            centred. `max-w` + `truncate` are new: absolute centring gave the
            title no width limit, so a long name (or a Malay translation)
            grew straight under the Back link and the right slot. 8.5rem
            reserves both 44px slots plus their 16px gutters.
          */
          <h1 className="absolute left-1/2 max-w-[calc(100%-8.5rem)] -translate-x-1/2 truncate text-[17px] font-semibold">
            {title}
          </h1>
        )}
        <div className="min-w-[44px] text-right">{right}</div>
      </div>
    </header>
  );
}
