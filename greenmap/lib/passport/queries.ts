import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Farm, GrowthLog, HarvestPassport, Plant } from "@/types/database";

/*
 * What the PUBLIC passport page reads. A passport is opened by anyone who
 * scans its QR code, signed in or not, so this is the one page loader that
 * uses the service-role client — and it lives here, not in the page, so the
 * page file never touches that client. The unguessable `qr_token` is the key:
 * nothing is returned without a matching passport.
 */

/*
 * Only the columns the public page shows are read. The page is open to the
 * whole internet, so "select *" would be one careless prop away from
 * publishing things like the farm's exact GPS position.
 */
const PASSPORT_COLUMNS =
  "plant_id, farm_id, harvest_date, grow_days, avg_health, ai_scan_count, pesticide_free, organic, ai_verified";
const PLANT_COLUMNS = "name, type";
const FARM_COLUMNS = "id, user_id, name, location";
const STORY_COLUMNS = "id, event_type, note, created_at";

export interface PublicPassport {
  passport: Pick<
    HarvestPassport,
    | "plant_id"
    | "farm_id"
    | "harvest_date"
    | "grow_days"
    | "avg_health"
    | "ai_scan_count"
    | "pesticide_free"
    | "organic"
    | "ai_verified"
  >;
  plant: Pick<Plant, "name" | "type">;
  farm: Pick<Farm, "id" | "user_id" | "name" | "location">;
  /** The grower's public details (null if the profile row is missing). */
  grower: { name: string; is_verified: boolean } | null;
  /** The plant's growth logs, oldest first. */
  story: Pick<GrowthLog, "id" | "event_type" | "note" | "created_at">[];
}

/** A passport token is a UUID; anything else cannot match a row. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The passport for a QR token, or null when the token matches nothing.
 * Opened from a QR code, often on mobile data, so it runs in as few round
 * trips as the data allows: the passport, then plant + farm + story
 * together, then the grower (who is only known from the farm row).
 */
export const getPublicPassport = cache(
  async (qrToken: string): Promise<PublicPassport | null> => {
    if (!UUID.test(qrToken)) return null;
    const admin = createAdminClient();

    const { data: passportRow } = await admin
      .from("harvest_passports")
      .select(PASSPORT_COLUMNS)
      .eq("qr_token", qrToken)
      .maybeSingle();
    if (!passportRow) return null;
    const passport = passportRow as PublicPassport["passport"];

    const [{ data: plant }, { data: farm }, { data: logs }] = await Promise.all([
      admin.from("plants").select(PLANT_COLUMNS).eq("id", passport.plant_id).maybeSingle(),
      admin.from("farms").select(FARM_COLUMNS).eq("id", passport.farm_id).maybeSingle(),
      admin
        .from("growth_logs")
        .select(STORY_COLUMNS)
        .eq("plant_id", passport.plant_id)
        .order("created_at", { ascending: true }),
    ]);
    if (!plant || !farm) return null;

    const { data: grower } = await admin
      .from("profiles")
      .select("name, is_verified")
      .eq("id", (farm as PublicPassport["farm"]).user_id)
      .maybeSingle();

    return {
      passport,
      plant: plant as PublicPassport["plant"],
      farm: farm as PublicPassport["farm"],
      grower: grower as { name: string; is_verified: boolean } | null,
      story: (logs ?? []) as PublicPassport["story"],
    };
  }
);
