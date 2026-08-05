import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { LanguageSetting } from "@/components/profile/LanguageSetting";
import {
  CONSUMER,
  FAVOURITES,
  ORDERS,
} from "@/components/consumer/demo-consumer";

/**
 * Consumer profile (Phase-3 preview). Membership + GreenPoints, quick stats,
 * favourite farms, settings rows, and sign out. Simulated data.
 */
export default async function ConsumerProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = (user?.user_metadata?.name as string | undefined) ?? "Member";
  const email = user?.email ?? "";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const stats = [
    { label: "GreenPoints", value: `🌱 ${CONSUMER.greenPoints}` },
    { label: "Orders", value: String(ORDERS.length) },
    { label: "Favourites", value: String(FAVOURITES.length) },
  ];

  const settings: { icon: string; label: string; href?: string }[] = [
    { icon: "📍", label: "Delivery addresses" },
    { icon: "💳", label: "Payment methods" },
    { icon: "🔔", label: "Notifications" },
    { icon: "🤖", label: "Help & support (AI admin)", href: "/consumer/support/admin" },
  ];

  return (
    <main
      id="main-content"
      className="px-5 pb-8 pt-12 lg:mx-auto lg:w-full lg:max-w-[720px] lg:px-8 lg:pt-10"
    >
      <div className="flex items-center gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
          Profile
        </p>
        <Badge tone="warning">PREVIEW</Badge>
      </div>

      {/* Identity */}
      <div className="mt-3 flex items-center gap-4 rounded-card p-4 glass">
        <span
          aria-hidden="true"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-brand text-[22px] font-bold text-white"
        >
          {initials || "🙂"}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-bold leading-tight">{name}</h1>
          {email && <p className="truncate text-[13px] text-secondary">{email}</p>}
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand/12 px-2 py-0.5 text-[11px] font-semibold text-brand-dark">
            ✓ {CONSUMER.tier}
          </span>
        </div>
      </div>

      {/* Quick stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card p-3 text-center glass">
            {/* brand-dark: plain brand measures 4.46:1 on a glass card. */}
            <p className="text-[16px] font-bold leading-none text-brand-dark">{s.value}</p>
            <p className="mt-1.5 text-[11px] leading-tight text-secondary">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Favourite farms */}
      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Favourite Farms
      </h2>
      <div className="overflow-hidden rounded-card glass">
        {FAVOURITES.map((f, i) => (
          <div
            key={f.name}
            className={`flex items-center gap-3 p-4 ${i > 0 ? "hairline-t" : ""}`}
          >
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-input bg-fill text-[18px]"
            >
              {f.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{f.name}</p>
              <p className="truncate text-[12px] text-secondary">
                {f.grower} · {f.location}
              </p>
            </div>
            {f.verified && <Badge tone="brand">✓ Passport</Badge>}
          </div>
        ))}
      </div>

      {/* Settings */}
      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
        Settings
      </h2>
      <div className="mb-3">
        <LanguageSetting />
      </div>
      <div className="overflow-hidden rounded-card glass">
        {settings.map((s, i) => {
          const cls = `flex w-full items-center gap-3 p-4 text-left active:bg-fill/40 ${
            i > 0 ? "hairline-t" : ""
          }`;
          const inner = (
            <>
              <span aria-hidden="true" className="text-[18px]">
                {s.icon}
              </span>
              <span className="flex-1 text-[14px] font-medium">{s.label}</span>
              <span aria-hidden="true" className="text-tertiary">
                ›
              </span>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className={cls}>
              {inner}
            </Link>
          ) : (
            <button key={s.label} type="button" className={cls}>
              {inner}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <SignOutButton full />
      </div>

      <p className="mt-4 text-center text-[12px] text-secondary">
        Want to sell your own harvest?{" "}
        <Link href="/auth" className="font-semibold text-brand">
          Grower sign-up
        </Link>
      </p>
    </main>
  );
}
