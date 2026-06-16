"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { BackgroundType, FarmSize } from "@/types/database";

/** A pending zone before the farm is saved (no id yet). */
export interface DraftZone {
  name: string;
  color: string;
}

/** All wizard state. Lives only in memory — saved to the DB once at Step 3. */
export interface FarmSetupState {
  // Step 1
  name: string;
  location: string; // Malaysian state
  size: FarmSize;
  cropType: string;
  // Step 2
  backgroundType: BackgroundType;
  backgroundUrl: string | null; // set when an upload succeeds
  // Step 3
  zones: DraftZone[];
}

interface FarmSetupContextValue extends FarmSetupState {
  update: (patch: Partial<FarmSetupState>) => void;
  addZone: (zone: DraftZone) => void;
  removeZone: (index: number) => void;
  reset: () => void;
}

const initialState: FarmSetupState = {
  name: "",
  location: "",
  size: "small",
  cropType: "",
  backgroundType: "smart",
  backgroundUrl: null,
  zones: [],
};

const FarmSetupContext = createContext<FarmSetupContextValue | null>(null);

export function FarmSetupProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FarmSetupState>(initialState);

  const update = (patch: Partial<FarmSetupState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const addZone = (zone: DraftZone) =>
    setState((prev) =>
      prev.zones.length >= 8 // cap at 8 (06 spec)
        ? prev
        : { ...prev, zones: [...prev.zones, zone] }
    );

  const removeZone = (index: number) =>
    setState((prev) => ({
      ...prev,
      zones: prev.zones.filter((_, i) => i !== index),
    }));

  const reset = () => setState(initialState);

  return (
    <FarmSetupContext.Provider
      value={{ ...state, update, addZone, removeZone, reset }}
    >
      {children}
    </FarmSetupContext.Provider>
  );
}

/** Access the wizard state. Throws if used outside the provider. */
export function useFarmSetup() {
  const ctx = useContext(FarmSetupContext);
  if (!ctx) {
    throw new Error("useFarmSetup must be used inside <FarmSetupProvider>.");
  }
  return ctx;
}
