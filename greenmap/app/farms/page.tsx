import { redirect } from "next/navigation";
import { getActivePlantCounts, getFarmList } from "@/lib/farm/fetch";
import { displayName } from "@/lib/auth/claims";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { FarmCard } from "@/components/farm/FarmCard";

export default async function FarmSelectorPage() {
  const { user, farms: farmList } = await getFarmList();
  const name = displayName(user, user?.email ?? "Grower");

  // Smart entry: only show the chooser when there's a real choice to make.
  if (farmList.length === 0) redirect("/farms/new/profile");
  if (farmList.length === 1) redirect(`/farms/${farmList[0].id}`);

  // Only the chooser shows plant counts, so they load after the redirects.
  const counts = await getActivePlantCounts(farmList.map((farm) => farm.id));

  return (
    <main className="desktop-breakout px-6 pb-12 pt-14 lg:mx-auto lg:w-full lg:max-w-[1100px] lg:px-8 lg:pt-16">
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
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {farmList.map((farm) => (
              <FarmCard
                key={farm.id}
                farm={farm}
                plantCount={counts[farm.id] ?? 0}
              />
            ))}
          </div>
          <div className="mt-6 lg:max-w-[360px]">
            <Button href="/farms/new/profile" variant="fill" full>
              + Create New Farm
            </Button>
          </div>
        </>
      )}

      <div className="mt-10">
        <SignOutButton full />
      </div>
    </main>
  );
}
