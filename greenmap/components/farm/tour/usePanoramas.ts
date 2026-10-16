"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FarmPanorama, PanoramaPlantTag } from "@/types/database";

/** Heading-slider writes wait for the drag to settle (one write per drag). */
const HEADING_SAVE_DELAY_MS = 400;

/**
 * Single data-access layer for the 360° tour. Owned by FarmMap so both the
 * 2D badges and the 3D viewer share one fetch. A missing table (migration
 * 0009 not run yet) is treated as "no panoramas" + loadError — never a crash.
 */
export function usePanoramas(farmId: string) {
  const [panoramas, setPanoramas] = useState<FarmPanorama[]>([]);
  const [tags, setTags] = useState<PanoramaPlantTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const headingTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>()
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: panos, error: pErr } = await supabase
        .from("farm_panoramas")
        .select("*")
        .eq("farm_id", farmId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (pErr) {
        console.warn("[tour] panoramas fetch failed:", pErr.message);
        setLoadError(true);
        setLoading(false);
        return;
      }
      setPanoramas(panos ?? []);
      if ((panos ?? []).length > 0) {
        const { data: tagRows, error: tErr } = await supabase
          .from("panorama_plant_tags")
          .select("*")
          .in(
            "panorama_id",
            (panos ?? []).map((p) => p.id)
          );
        if (cancelled) return;
        if (tErr) console.warn("[tour] tags fetch failed:", tErr.message);
        setTags(tagRows ?? []);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [farmId]);

  const addPanorama = useCallback(
    async (input: { file: File; position_x: number; position_y: number }) => {
      const supabase = createClient();
      const ext = input.file.name.split(".").pop()?.toLowerCase() || "jpg";
      // Not crypto.randomUUID(): it only exists in secure contexts, so it
      // throws when the app is opened over plain-http LAN (phone testing).
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const path = `${farmId}/${id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("farm-panoramas")
        .upload(path, input.file, { contentType: input.file.type });
      if (upErr) {
        console.warn("[tour] upload failed:", upErr.message);
        return null;
      }
      const { data: pub } = supabase.storage
        .from("farm-panoramas")
        .getPublicUrl(path);
      const { data, error } = await supabase
        .from("farm_panoramas")
        .insert({
          farm_id: farmId,
          image_url: pub.publicUrl,
          position_x: input.position_x,
          position_y: input.position_y,
        })
        .select()
        .single();
      if (error || !data) {
        console.warn("[tour] insert failed:", error?.message);
        // Every upload gets a fresh path, so a failed save would otherwise
        // leave an unreachable photo in the bucket on each retry.
        await supabase.storage.from("farm-panoramas").remove([path]);
        return null;
      }
      setPanoramas((prev) => [...prev, data as FarmPanorama]);
      return data as FarmPanorama;
    },
    [farmId]
  );

  const updateHeading = useCallback(async (id: string, heading_deg: number) => {
    // Optimistic: the photo rotates immediately while the slider drags.
    setPanoramas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, heading_deg } : p))
    );
    // Persist once the slider settles. Writing on every input event floods
    // the API and lets out-of-order responses leave a stale heading stored.
    const timers = headingTimers.current;
    const pending = timers.get(id);
    if (pending) clearTimeout(pending);
    timers.set(
      id,
      setTimeout(async () => {
        timers.delete(id);
        const supabase = createClient();
        const { error } = await supabase
          .from("farm_panoramas")
          .update({ heading_deg })
          .eq("id", id);
        if (error) console.warn("[tour] heading update failed:", error.message);
      }, HEADING_SAVE_DELAY_MS)
    );
  }, []);

  const addTag = useCallback(
    async (input: {
      panorama_id: string;
      plant_id: string;
      yaw: number;
      pitch: number;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("panorama_plant_tags")
        .upsert(input, { onConflict: "panorama_id,plant_id" })
        .select()
        .single();
      if (error || !data) {
        console.warn("[tour] tag insert failed:", error?.message);
        return null;
      }
      setTags((prev) => [
        ...prev.filter(
          (t) =>
            !(
              t.panorama_id === input.panorama_id &&
              t.plant_id === input.plant_id
            )
        ),
        data as PanoramaPlantTag,
      ]);
      return data as PanoramaPlantTag;
    },
    []
  );

  const removeTag = useCallback(async (id: string) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
    const supabase = createClient();
    const { error } = await supabase
      .from("panorama_plant_tags")
      .delete()
      .eq("id", id);
    if (error) console.warn("[tour] tag delete failed:", error.message);
  }, []);

  return {
    panoramas,
    tags,
    loading,
    loadError,
    addPanorama,
    updateHeading,
    addTag,
    removeTag,
  };
}
