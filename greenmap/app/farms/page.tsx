import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { FarmCard } from "@/components/farm/FarmCard";
import type { Farm } from "@/types/database";

export default async function FarmSelectorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name =
    (user?.user_metadata?.name as string | undefined) ?? user?.email ?? "Grower";

  // Fetch this user's farms (RLS limits the rows to their own).
  const { data: farms } = await supabase
    .from("farms")
    .select("*")
    .order("created_at", { ascending: false });

  const farmList = (farms ?? []) as Farm[];

  // Smart entry: only show the chooser when there's a real choice to make.
  if (farmList.length === 0) redirect("/farms/new/profile");
  if (farmList.length === 1) redirect(`/farms/${farmList[0].id}`);

  // Plant counts per farm, in one query.
  const counts: Record<string, number> = {};
  if (farmList.length > 0) {
    const { data: plants } = await supabase
      .from("plants")
      .select("farm_id");
    for (const row of plants ?? []) {
      const id = (row as { farm_id: string }).farm_id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }

  return (
    <main className="px-6 pb-12 pt-14">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
        Welcome, {name}
      </p>
      <h1 className="mt-1 text-[34px] font-bold leading-tight">Your Farms</h1>

      {farmList.length === 0 ? (
        <EmptyState
          icon="🌱"
          title="No farms yet"
          body="Create your first farm to start mapping plants, tracking health and building consumer trust."
        >
          <Button href="/farms/new/profile" full>
            Create New Farm
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4">
            {farmList.map((farm) => (
              <FarmCard
                key={farm.id}
                farm={farm}
                plantCount={counts[farm.id] ?? 0}
              />
            ))}
          </div>
          <Button href="/farms/new/profile" variant="fill" full className="mt-6">
            + Create New Farm
          </Button>
        </>
      )}

      <div className="mt-10">
        <SignOutButton full />
      </div>
    </main>
  );
}
