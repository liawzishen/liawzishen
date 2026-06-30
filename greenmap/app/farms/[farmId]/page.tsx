import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getFarmBundle } from "@/lib/farm/fetch";
import { FarmSwitcher } from "@/components/farm/FarmSwitcher";
import { TodaysTasks, type TaskItem } from "@/components/home/TodaysTasks";
import type { EventType } from "@/types/database";

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function relative(dateStr: string): string {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const EVENT_META: Record<EventType, { icon: string; label: string }> = {
  planted: { icon: "🌱", label: "Planted" },
  water: { icon: "💧", label: "Watered" },
  fertilize: { icon: "🌿", label: "Fertilized" },
  ai_scan: { icon: "🔬", label: "AI Scan" },
  note: { icon: "📝", label: "Note" },
  harvested: { icon: "🧺", label: "Harvested" },
};

export default async function FarmHomePage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const bundle = await getFarmBundle(farmId);
  if (!bundle) notFound();
  const { farm, plants } = bundle;

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const farmerName =
    typeof meta.name === "string" && meta.name.trim() ? meta.name : "there";

  const { data: farms } = await supabase
    .from("farms")
    .select("id, name")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  const active = plants.filter((p) => p.lifecycle_status === "active");
  const activeIds = active.map((p) => p.id);
  const nameById = new Map(plants.map((p) => [p.id, p.name]));
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: careLogs }, { data: feed }] = await Promise.all([
    supabase
      .from("growth_logs")
      .select("plant_id, event_type, created_at")
      .in("plant_id", activeIds)
      .in("event_type", ["water", "fertilize"])
      .order("created_at", { ascending: false }),
    supabase
      .from("growth_logs")
      .select("plant_id, event_type, note, created_at")
      .in("plant_id", activeIds)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const lastWater = new Map<string, string>();
  const lastFert = new Map<string, string>();
  for (const l of careLogs ?? []) {
    if (l.event_type === "water" && !lastWater.has(l.plant_id))
      lastWater.set(l.plant_id, l.created_at);
    else if (l.event_type === "fertilize" && !lastFert.has(l.plant_id))
      lastFert.set(l.plant_id, l.created_at);
  }

  // Quick stats
  const healthy = active.filter(
    (p) => p.health_score !== null && p.health_score >= 70
  ).length;
  const needCare = active.filter(
    (p) => p.health_score !== null && p.health_score < 70
  ).length;
  const harvestReadyCount = active.filter(
    (p) => p.expected_harvest_date && p.expected_harvest_date <= today
  ).length;

  // Task groups
  const harvest: TaskItem[] = [];
  const water: TaskItem[] = [];
  const fertilize: TaskItem[] = [];
  for (const p of active) {
    if (p.expected_harvest_date && p.expected_harvest_date <= today) {
      harvest.push({ plantId: p.id, plantName: p.name, sub: `Ready since ${p.expected_harvest_date}` });
    }
    const lw = lastWater.get(p.id);
    if (lw ? daysSince(lw) >= 3 : daysSince(p.plant_date) >= 2) {
      water.push({ plantId: p.id, plantName: p.name, sub: lw ? `Last watered ${daysSince(lw)}d ago` : "Not watered yet" });
    }
    const lf = lastFert.get(p.id);
    if (lf ? daysSince(lf) >= 14 : daysSince(p.plant_date) >= 7) {
      fertilize.push({ plantId: p.id, plantName: p.name, sub: lf ? `Last fertilized ${daysSince(lf)}d ago` : "Not fertilized yet" });
    }
  }
  const totalTasks = harvest.length + water.length + fertilize.length;

  const feedItems = (feed ?? []) as {
    plant_id: string;
    event_type: EventType;
    note: string | null;
    created_at: string;
  }[];

  const stats = [
    { label: "Plants", value: active.length, color: "#1E434A" },
    { label: "Healthy", value: healthy, color: "#0DB074" },
    { label: "Need Care", value: needCare, color: "#F59E0B" },
    { label: "Harvest", value: harvestReadyCount, color: "#3B82F6" },
  ];

  return (
    <AppShell farmId={farmId}>
      <main className="px-5 pt-12">
        {/* Greeting */}
        <p className="text-[12px] font-semibold uppercase tracking-widest text-secondary">
          {new Date().toLocaleDateString("en-MY", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight">
          Hi, {farmerName} 👋
        </h1>
        <FarmSwitcher
          farms={(farms ?? []) as { id: string; name: string }[]}
          currentId={farmId}
          currentName={farm.name}
          className="text-[14px] font-medium text-secondary"
        />

        {/* Quick stats */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-card bg-card p-3 text-center shadow-card"
            >
              <p
                className="text-[22px] font-bold leading-none"
                style={{ color: s.color }}
              >
                {s.value}
              </p>
              <p className="mt-1 text-[11px] leading-tight text-secondary">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Today's tasks */}
        <div className="mb-2 mt-7 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-secondary">
            Today&apos;s Tasks
          </h2>
          {totalTasks > 0 && (
            <span className="text-[12px] font-medium text-secondary">
              {totalTasks} to do
            </span>
          )}
        </div>
        <TodaysTasks groups={{ harvest, water, fertilize }} farmId={farmId} />

        {/* Sales summary (placeholder) */}
        <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
          Sales
        </h2>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold">Your Harvest, Sold</p>
            <Badge tone="neutral">Coming soon</Badge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              { label: "Products Sold", v: "—" },
              { label: "Active Listings", v: "—" },
              { label: "Revenue", v: "—" },
            ].map((x) => (
              <div key={x.label} className="rounded-input bg-fill p-3 text-center">
                <p className="text-[18px] font-bold text-secondary">{x.v}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-secondary">
                  {x.label}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-secondary">
            List your harvest and track orders here in a later phase.
          </p>
        </Card>

        {/* Recent activity */}
        <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-wide text-secondary">
          Recent Activity
        </h2>
        {feedItems.length === 0 ? (
          <Card className="text-center text-[14px] text-secondary">
            No activity yet — log care or run a scan to get started.
          </Card>
        ) : (
          <Card className="p-0">
            {feedItems.map((f, i) => {
              const m = EVENT_META[f.event_type] ?? { icon: "•", label: f.event_type };
              return (
                <Link
                  key={i}
                  href={`/farms/${farmId}/plants/${f.plant_id}`}
                  className={`flex items-center gap-3 p-4 ${i > 0 ? "hairline-t" : ""}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-[16px]">
                    {m.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">
                      {nameById.get(f.plant_id) ?? "Plant"} · {m.label}
                    </p>
                    {f.note && (
                      <p className="truncate text-[12px] text-secondary">{f.note}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[12px] text-secondary">
                    {relative(f.created_at)}
                  </span>
                </Link>
              );
            })}
          </Card>
        )}
      </main>
    </AppShell>
  );
}
