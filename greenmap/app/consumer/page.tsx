import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function ConsumerHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = (user?.user_metadata?.name as string | undefined) ?? "there";

  return (
    <main className="px-6 pb-12 pt-14">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
        GreenMap
      </p>
      <h1 className="mt-1 text-[34px] font-bold leading-tight">Hi, {name} 👋</h1>
      <p className="mt-1 text-[15px] text-secondary">Know your food's story.</p>

      <Card className="mt-8 text-center">
        <div aria-hidden className="text-[44px]">📷</div>
        <h2 className="mt-2 text-[17px] font-semibold">
          Scan a Harvest Passport
        </h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-secondary">
          Point your phone camera at a GreenMap QR code on any produce to see
          its full growing journey. Passport stories go live in Phase 7.
        </p>
      </Card>

      <div className="mt-8">
        <SignOutButton full />
      </div>
    </main>
  );
}
