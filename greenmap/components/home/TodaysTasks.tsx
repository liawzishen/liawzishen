"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type TaskItem = { plantId: string; plantName: string; sub: string };
export type TaskGroups = { harvest: TaskItem[]; water: TaskItem[]; fertilize: TaskItem[] };

type GroupKey = keyof TaskGroups;
type CareAction = "water" | "fertilize";
type CompletedEntry = { item: TaskItem; group: GroupKey; action: CareAction };

const CATEGORIES: {
  key: GroupKey;
  icon: string;
  label: string;
  action: CareAction | null;
  batchLabel: string | null;
}[] = [
  { key: "harvest", icon: "🧺", label: "Ready to Harvest", action: null, batchLabel: null },
  { key: "water", icon: "💧", label: "Needs Watering", action: "water", batchLabel: "Water All" },
  { key: "fertilize", icon: "🌿", label: "Needs Fertilizing", action: "fertilize", batchLabel: "Fertilize All" },
];

const DONE_LABEL: Record<CareAction, string> = { water: "Watered", fertilize: "Fertilized" };

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`text-tertiary transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function TodaysTasks({
  groups: initial,
  farmId,
}: {
  groups: TaskGroups;
  farmId: string;
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<TaskGroups>(initial);
  const [completed, setCompleted] = useState<CompletedEntry[]>([]);

  const firstNonEmpty = CATEGORIES.find((c) => initial[c.key].length > 0)?.key;
  const [open, setOpen] = useState<Record<GroupKey, boolean>>({
    harvest: firstNonEmpty === "harvest",
    water: firstNonEmpty === "water",
    fertilize: firstNonEmpty === "fertilize",
  });
  const [busy, setBusy] = useState<Record<GroupKey, boolean>>({
    harvest: false, water: false, fertilize: false,
  });
  const [doneOpen, setDoneOpen] = useState(false);

  const activeTotal =
    groups.harvest.length + groups.water.length + groups.fertilize.length;

  function toggle(key: GroupKey) {
    setOpen((o) => ({ ...o, [key]: !o[key] }));
  }

  async function send(kind: "complete" | "uncomplete", action: CareAction, plantIds: string[]) {
    const res = await fetch(`/api/tasks/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, plantIds }),
    });
    if (!res.ok) throw new Error(`${kind} failed`);
  }

  async function completeOne(group: GroupKey, action: CareAction, item: TaskItem) {
    setGroups((g) => ({ ...g, [group]: g[group].filter((t) => t.plantId !== item.plantId) }));
    setCompleted((c) => [{ item, group, action }, ...c]);
    try {
      await send("complete", action, [item.plantId]);
      router.refresh();
    } catch {
      setCompleted((c) => c.filter((e) => !(e.action === action && e.item.plantId === item.plantId)));
      setGroups((g) => ({ ...g, [group]: [item, ...g[group]] }));
    }
  }

  async function completeAll(group: GroupKey, action: CareAction) {
    const items = groups[group];
    if (items.length === 0 || busy[group]) return;
    setBusy((b) => ({ ...b, [group]: true }));
    setGroups((g) => ({ ...g, [group]: [] }));
    setCompleted((c) => [...items.map((item) => ({ item, group, action })), ...c]);
    try {
      await send("complete", action, items.map((t) => t.plantId));
      router.refresh();
    } catch {
      setGroups((g) => ({ ...g, [group]: items }));
      setCompleted((c) =>
        c.filter((e) => !(e.group === group && items.some((i) => i.plantId === e.item.plantId)))
      );
    } finally {
      setBusy((b) => ({ ...b, [group]: false }));
    }
  }

  async function uncheck(entry: CompletedEntry) {
    setCompleted((c) =>
      c.filter((e) => !(e.action === entry.action && e.item.plantId === entry.item.plantId))
    );
    setGroups((g) => ({ ...g, [entry.group]: [entry.item, ...g[entry.group]] }));
    try {
      await send("uncomplete", entry.action, [entry.item.plantId]);
      router.refresh();
    } catch {
      setGroups((g) => ({
        ...g,
        [entry.group]: g[entry.group].filter((t) => t.plantId !== entry.item.plantId),
      }));
      setCompleted((c) => [entry, ...c]);
    }
  }

  if (activeTotal === 0 && completed.length === 0) {
    return (
      <div className="rounded-card p-6 text-center glass">
        <p className="text-[15px] font-medium">All caught up 🎉</p>
        <p className="mt-1 text-[13px] text-secondary">No tasks need you right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeTotal === 0 && completed.length > 0 && (
        <p className="text-center text-[14px] font-medium text-brand">
          All tasks done 🎉
        </p>
      )}

      {/* Active categories */}
      {CATEGORIES.map((cat) => {
        const items = groups[cat.key];
        if (items.length === 0) return null;
        const isOpen = open[cat.key];

        return (
          <div key={cat.key} className="overflow-hidden rounded-card glass">
            <div className="flex items-center gap-2 p-3.5">
              <button
                type="button"
                onClick={() => toggle(cat.key)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <span className="text-[18px]">{cat.icon}</span>
                <span className="text-[14px] font-semibold">{cat.label}</span>
                <span className="rounded-full bg-fill px-2 py-0.5 text-[12px] font-semibold text-secondary">
                  {items.length}
                </span>
                <Chevron open={isOpen} />
              </button>
              {cat.action && cat.batchLabel && (
                <button
                  type="button"
                  onClick={() => completeAll(cat.key, cat.action as CareAction)}
                  disabled={busy[cat.key]}
                  className="shrink-0 rounded-full bg-brand/10 px-3 py-1.5 text-[12px] font-semibold text-brand active:opacity-80 disabled:opacity-50"
                >
                  {busy[cat.key] ? "…" : cat.batchLabel}
                </button>
              )}
            </div>

            {isOpen && (
              <div className="px-3.5 pb-3.5">
                {/* ~4–5 rows visible; longer lists scroll inside the box */}
                <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {items.map((item) =>
                    cat.action ? (
                      <button
                        key={item.plantId}
                        type="button"
                        onClick={() => completeOne(cat.key, cat.action as CareAction, item)}
                        className="flex w-full items-center gap-3 rounded-input bg-fill/60 p-3 text-left transition active:bg-brand/5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium">{item.plantName}</p>
                          <p className="truncate text-[12px] text-secondary">{item.sub}</p>
                        </div>
                        <span
                          aria-hidden
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-tertiary"
                        >
                          <Check className="text-transparent" />
                        </span>
                      </button>
                    ) : (
                      <Link
                        key={item.plantId}
                        href={`/farms/${farmId}/plants/${item.plantId}/harvest`}
                        className="flex items-center gap-3 rounded-input bg-fill/60 p-3 active:opacity-80"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium">{item.plantName}</p>
                          <p className="truncate text-[12px] text-secondary">{item.sub}</p>
                        </div>
                        <span className="shrink-0 text-[13px] font-semibold text-brand">
                          Harvest ›
                        </span>
                      </Link>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Completed Today */}
      {completed.length > 0 && (
        <div className="overflow-hidden rounded-card glass">
          <button
            type="button"
            onClick={() => setDoneOpen((v) => !v)}
            className="flex w-full items-center gap-2 p-3.5 text-left"
          >
            <span className="text-[18px]">✅</span>
            <span className="text-[14px] font-semibold">Completed Today</span>
            <span className="rounded-full bg-fill px-2 py-0.5 text-[12px] font-semibold text-secondary">
              {completed.length}
            </span>
            <Chevron open={doneOpen} />
          </button>

          {doneOpen && (
            <div className="px-3.5 pb-3.5">
              <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                {completed.map((entry) => (
                  <div
                    key={`${entry.action}:${entry.item.plantId}`}
                    className="flex items-center gap-3 rounded-input bg-fill/40 p-3"
                  >
                    <div className="min-w-0 flex-1 opacity-60">
                      <p className="truncate text-[14px] font-medium text-secondary line-through">
                        {entry.item.plantName}
                      </p>
                      <p className="truncate text-[12px] text-secondary">
                        {DONE_LABEL[entry.action]}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => uncheck(entry)}
                      aria-label={`Undo ${entry.item.plantName}`}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-white active:opacity-80"
                    >
                      <Check />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
