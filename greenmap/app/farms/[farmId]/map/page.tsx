import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FarmCard } from "@/components/farm/FarmCard";
import type { Farm } from "@/types/database";

/**
 * Map tab = the farmer's farms. Tap a farm card to open its field view
 * (`/farms/[id]/field`), which holds the KPI strip + interactive map.
 */
export default async function FarmMapPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: farms } = await supabase
    .from("farms")
    .select("*")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false });
  const farmList = (farms ?? []) as Farm[];

  const counts: Record<string, number> = {};
  if (farmList.length > 0) {
    const { data: plants } = await supabase.from("plants").select("farm_id");
    for (const row of plants ?? []) {
      const id = (row as { farm_id: string }).farm_id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }

  return (
    <AppShell farmId={farmId}>
      <main className="px-5 pt-12">
        <h1 className="text-[28px] font-bold leading-tight">Your Farms</h1>
        <p className="mt-0.5 text-[14px] text-secondary">
          {farmList.length} {farmList.length === 1 ? "farm" : "farms"} · tap one
          to open its map
        </p>

        {farmList.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon="🌱"
              title="No farms yet"
              body="Create your first farm to start mapping plants."
            >
              <Button href="/farms/new/profile" full>
                Create New Farm
              </Button>
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-1 gap-4">
              {farmList.map((f) => (
                <FarmCard
                  key={f.id}
                  farm={f}
                  plantCount={counts[f.id] ?? 0}
                  href={`/farms/${f.id}/field`}
                />
              ))}
            </div>
            <Button
              href="/farms/new/profile"
              variant="fill"
              full
              className="mt-6"
            >
              + Create New Farm
            </Button>
          </>
        )}
      </main>
    </AppShell>
  );
}
