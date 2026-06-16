import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SignOutButton } from "@/components/auth/SignOutButton";

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

  const meta = (user?.user_metadata ?? {}) as { name?: string; role?: string };
  const rows = [
    { label: "Name", value: meta.name ?? "—" },
    { label: "Email", value: user?.email ?? "—" },
    { label: "Role", value: meta.role === "consumer" ? "Consumer" : "Grower" },
  ];

  return (
    <AppShell farmId={farmId}>
      <main className="px-6 pt-14">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
          Account
        </p>
        <h1 className="mt-1 text-[34px] font-bold leading-tight">Profile</h1>

        <Card className="mt-6 p-0">
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center justify-between p-4 ${i > 0 ? "hairline-t" : ""}`}
            >
              <span className="text-[15px] text-secondary">{row.label}</span>
              <span className="text-[15px] font-medium">{row.value}</span>
            </div>
          ))}
        </Card>

        <Button href="/farms" variant="fill" full className="mt-4">
          Switch Farm
        </Button>
        <div className="mt-3">
          <SignOutButton full />
        </div>

        <p className="mt-4 text-center text-[12px] text-secondary">
          Verified Grower status is set in Phase 2 (profiles table).
        </p>
      </main>
    </AppShell>
  );
}
