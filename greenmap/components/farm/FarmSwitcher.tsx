"use client";

import { useState } from "react";
import Link from "next/link";

type FarmLite = { id: string; name: string };

/**
 * Tappable farm name → bottom sheet to switch farms or create a new one.
 * Replaces the old full-screen "Your Farms" list on the Map tab, so the farm
 * list only appears when there's a real choice to make.
 */
export function FarmSwitcher({
  farms,
  currentId,
  currentName,
  className,
}: {
  farms: FarmLite[];
  currentId: string;
  currentName: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex max-w-full items-center gap-1 text-left active:opacity-70"
      >
        <span className={className}>{currentName}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-secondary"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-0 w-full max-w-[430px] rounded-t-card bg-card p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              aria-hidden
              className="mx-auto mb-4 h-1 w-10 rounded-full bg-tertiary"
            />
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-secondary">
              Switch Farm
            </p>
            <div className="space-y-1">
              {farms.map((f) => {
                const active = f.id === currentId;
                return (
                  <Link
                    key={f.id}
                    href={`/farms/${f.id}`}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-[48px] items-center gap-3 rounded-input px-3 ${
                      active ? "bg-brand/10" : "active:bg-fill"
                    }`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fill text-[15px]">
                      🌱
                    </span>
                    <span className="flex-1 truncate text-[15px] font-medium">
                      {f.name}
                    </span>
                    {active && <span className="text-brand">✓</span>}
                  </Link>
                );
              })}
            </div>
            <Link
              href="/farms/new/profile"
              onClick={() => setOpen(false)}
              className="mt-2 flex min-h-[48px] items-center gap-3 rounded-input px-3 text-[15px] font-semibold text-brand active:bg-fill"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 text-[18px]">
                ＋
              </span>
              Create new farm
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
