import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "@/components/profile/ProfileClient";
import { getScanAllowance } from "@/lib/billing/usage";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const meta = (user.user_metadata ?? {}) as {
    name?: string;
    role?: string;
    headline?: string;
    avatar_url?: string;
  };

  // profiles mirrors name + holds the Verified Grower flag.
  const [{ data: profile }, allowance] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, is_verified")
      .eq("id", user.id)
      .maybeSingle(),
    getScanAllowance(supabase, user.id),
  ]);
  const p = profile as { name: string; is_verified: boolean } | null;

  const name = (meta.name || p?.name || "").toString();
  const role = meta.role === "consumer" ? "consumer" : "grower";
  const scansLine =
    allowance.remaining === null
      ? "Unlimited scans"
      : `${allowance.remaining} scan${allowance.remaining === 1 ? "" : "s"} left`;

  return (
    <main className="px-5 pb-10 pt-12 lg:mx-auto lg:w-full lg:max-w-[720px] lg:px-8 lg:pt-10">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
        Account
      </p>
      <h1 className="mb-5 mt-1 text-[28px] font-bold leading-tight">Profile</h1>

      <ProfileClient
        userId={user.id}
        email={user.email ?? "—"}
        role={role}
        initialName={name}
        headline={(meta.headline ?? "").toString()}
        avatarUrl={meta.avatar_url ?? null}
        isVerified={p?.is_verified ?? false}
        memberSince={user.created_at}
        planSlot={
          <Link
            href={`/farms/${farmId}/plan`}
            className="pressable mt-4 flex items-center justify-between gap-3 rounded-card p-4 glass"
          >
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-secondary">
                My Plan
              </p>
              <p className="mt-0.5 truncate text-[16px] font-semibold">
                {allowance.planName}
                <span className="ml-2 text-[13px] font-normal text-secondary">
                  🔬 {scansLine}
                </span>
              </p>
            </div>
            <span aria-hidden className="text-[18px] text-tertiary">
              ›
            </span>
          </Link>
        }
      />
    </main>
  );
}
