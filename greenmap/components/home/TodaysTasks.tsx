"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";

export type TaskItem = { plantId: string; plantName: string; sub: string };
export type TaskGroups = { harvest: TaskItem[]; water: TaskItem[]; fertilize: TaskItem[] };

type GroupKey = keyof TaskGroups;
type CareAction = "water" | "fertilize";
type CompletedEntry = { item: TaskItem; group: GroupKey; action: CareAction };

/** Static category config — display labels come from the dictionary. */
const CATEGORIES: {
  key: GroupKey;
  icon: string;
  action: CareAction | null;
}[] = [
  { key: "harvest", icon: "🧺", action: null },
  { key: "water", icon: "💧", action: "water" },
  { key: "fertilize", icon: "🌿", action: "fertilize" },
];

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
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
      aria-hidden
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
  const { t } = useI18n();
  const [groups, setGroups] = useState<TaskGroups>(initial);
  const [completed, setCompleted] = useState<CompletedEntry[]>([]);
  /*
   * Completing a task is an optimistic write with a silent rollback: the row
   * vanishes (or reappears) with nothing said. These two live regions narrate
   * both outcomes — success politely, a failed save assertively, because a
   * task the grower believes is logged and isn't matters.
   */
  const [announcement, setAnnouncement] = useState("");
  const [failure, setFailure] = useState("");

  const groupLabel: Record<GroupKey, string> = {
    harvest: t.home.readyToHarvest,
    water: t.home.needsWatering,
    fertilize: t.home.needsFertilizing,
  };
  const batchLabel: Record<CareAction, string> = {
    water: t.home.waterAll,
    fertilize: t.home.fertilizeAll,
  };
  const doneLabel: Record<CareAction, string> = {
    water: t.home.watered,
    fertilize: t.home.fertilized,
  };

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
    setFailure("");
    try {
      await send("complete", action, [item.plantId]);
      setAnnouncement(`${item.plantName} — ${doneLabel[action]}`);
      router.refresh();
    } catch {
      setCompleted((c) => c.filter((e) => !(e.action === action && e.item.plantId === item.plantId)));
      setGroups((g) => ({ ...g, [group]: [item, ...g[group]] }));
      setFailure(`Couldn't save ${item.plantName}. It's back in the list.`);
    }
  }

  async function completeAll(group: GroupKey, action: CareAction) {
    const items = groups[group];
    if (items.length === 0 || busy[group]) return;
    setBusy((b) => ({ ...b, [group]: true }));
    setGroups((g) => ({ ...g, [group]: [] }));
    setCompleted((c) => [...items.map((item) => ({ item, group, action })), ...c]);
    setFailure("");
    try {
      await send("complete", action, items.map((t) => t.plantId));
      setAnnouncement(`${items.length} plants — ${doneLabel[action]}`);
      router.refresh();
    } catch {
      setGroups((g) => ({ ...g, [group]: items }));
      setCompleted((c) =>
        c.filter((e) => !(e.group === group && items.some((i) => i.plantId === e.item.plantId)))
      );
      setFailure(`Couldn't save ${groupLabel[group]}. Those plants are back in the list.`);
    } finally {
      setBusy((b) => ({ ...b, [group]: false }));
    }
  }

  async function uncheck(entry: CompletedEntry) {
    setCompleted((c) =>
      c.filter((e) => !(e.action === entry.action && e.item.plantId === entry.item.plantId))
    );
    setGroups((g) => ({ ...g, [entry.group]: [entry.item, ...g[entry.group]] }));
    setFailure("");
    try {
      await send("uncomplete", entry.action, [entry.item.plantId]);
      setAnnouncement(`${entry.item.plantName} moved back to ${groupLabel[entry.group]}`);
      router.refresh();
    } catch {
      setGroups((g) => ({
        ...g,
        [entry.group]: g[entry.group].filter((t) => t.plantId !== entry.item.plantId),
      }));
      setCompleted((c) => [entry, ...c]);
      setFailure(`Couldn't undo ${entry.item.plantName}.`);
    }
  }

  if (activeTotal === 0 && completed.length === 0) {
    return (
      <div className="rounded-card p-6 text-center glass">
        <p className="text-[15px] font-medium">{t.home.allCaughtUp}</p>
        <p className="mt-1 text-[13px] text-secondary">{t.home.noTasks}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeTotal === 0 && completed.length > 0 && (
        <p className="text-center text-[14px] font-medium text-brand">
          {t.home.allDone}
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
                aria-expanded={isOpen}
                aria-controls={`tasks-${cat.key}`}
                className="flex min-h-[44px] flex-1 items-center gap-2 text-left"
              >
                <span aria-hidden className="text-[18px]">{cat.icon}</span>
                <span className="text-[15px] font-semibold">
                  {groupLabel[cat.key]}
                </span>
                <span className="rounded-full bg-fill px-2 py-0.5 text-[12px] font-semibold text-secondary">
                  {items.length}
                </span>
                <Chevron open={isOpen} />
              </button>
              {cat.action && (
                <button
                  type="button"
                  onClick={() => completeAll(cat.key, cat.action as CareAction)}
                  disabled={busy[cat.key]}
                  aria-busy={busy[cat.key]}
                  // While saving the label collapses to "…", which would leave
                  // the button nameless — pin the name to the real action.
                  aria-label={batchLabel[cat.action]}
                  className="min-h-[40px] shrink-0 rounded-full bg-brand/10 px-4 py-2 text-[13px] font-semibold text-brand-dark active:opacity-80 disabled:opacity-50"
                >
                  {busy[cat.key] ? "…" : batchLabel[cat.action]}
                </button>
              )}
            </div>

            {isOpen && (
              <div id={`tasks-${cat.key}`} className="px-3.5 pb-3.5">
                {/* ~4–5 rows visible; longer lists scroll inside the box */}
                <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {items.map((item) =>
                    cat.action ? (
                      /*
                       * This row is a checkbox in all but name — a ring on the
                       * right that fills in when the care is logged. Announcing
                       * it as a plain button hid both what it does and the fact
                       * that it has an on/off state.
                       */
                      <button
                        key={item.plantId}
                        type="button"
                        role="checkbox"
                        aria-checked={false}
                        onClick={() => completeOne(cat.key, cat.action as CareAction, item)}
                        className="flex min-h-[60px] w-full items-center gap-3 rounded-input bg-fill/60 p-3.5 text-left transition active:bg-brand/5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium">{item.plantName}</p>
                          <p className="truncate text-[12px] text-secondary">{item.sub}</p>
                        </div>
                        <span
                          aria-hidden
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-tertiary"
                        >
                          <Check className="text-transparent" />
                        </span>
                      </button>
                    ) : (
                      <Link
                        key={item.plantId}
                        href={`/farms/${farmId}/plants/${item.plantId}/harvest`}
                        className="flex min-h-[60px] items-center gap-3 rounded-input bg-fill/60 p-3.5 active:opacity-80"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium">{item.plantName}</p>
                          <p className="truncate text-[12px] text-secondary">{item.sub}</p>
                        </div>
                        <span className="shrink-0 text-[14px] font-semibold text-brand-dark">
                          {t.home.harvest} <span aria-hidden>›</span>
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
            aria-expanded={doneOpen}
            aria-controls="tasks-completed"
            className="flex w-full items-center gap-2 p-3.5 text-left"
          >
            <span aria-hidden className="text-[18px]">✅</span>
            <span className="text-[14px] font-semibold">{t.home.completedToday}</span>
            <span className="rounded-full bg-fill px-2 py-0.5 text-[12px] font-semibold text-secondary">
              {completed.length}
            </span>
            <Chevron open={doneOpen} />
          </button>

          {doneOpen && (
            <div id="tasks-completed" className="px-3.5 pb-3.5">
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
                        {doneLabel[entry.action]}
                      </p>
                    </div>
                    {/* The checked half of the same control: a filled tick that
                        un-checks the task. Same role as the active row so the
                        two states read as one widget, not two gadgets. */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked
                      onClick={() => uncheck(entry)}
                      aria-label={`${entry.item.plantName} — ${doneLabel[entry.action]}`}
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
