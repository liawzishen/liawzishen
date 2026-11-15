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

export interface PublicPassport {
  passport: HarvestPassport;
  plant: Plant;
  farm: Farm;
  /** The grower's public details (null if the profile row is missing). */
  grower: { name: string; is_verified: boolean } | null;
  /** The plant's growth logs, oldest first. */
  story: GrowthLog[];
}

/**
 * The passport for a QR token, or null when the token matches nothing.
 * Opened from a QR code, often on mobile data, so it runs in as few round
 * trips as the data allows: the passport, then plant + farm + story
 * together, then the grower (who is only known from the farm row).
 */
export const getPublicPassport = cache(
  async (qrToken: string): Promise<PublicPassport | null> => {
    const admin = createAdminClient();

    const { data: passportRow } = await admin
      .from("harvest_passports")
      .select("*")
      .eq("qr_token", qrToken)
      .maybeSingle();
    if (!passportRow) return null;
    const passport = passportRow as HarvestPassport;

    const [{ data: plant }, { data: farm }, { data: logs }] = await Promise.all([
      admin.from("plants").select("*").eq("id", passport.plant_id).maybeSingle(),
      admin.from("farms").select("*").eq("id", passport.farm_id).maybeSingle(),
      admin
        .from("growth_logs")
        .select("*")
        .eq("plant_id", passport.plant_id)
        .order("created_at", { ascending: true }),
    ]);
    if (!plant || !farm) return null;

    const { data: grower } = await admin
      .from("profiles")
      .select("name, is_verified")
      .eq("id", (farm as Farm).user_id)
      .maybeSingle();

    return {
      passport,
      plant: plant as Plant,
      farm: farm as Farm,
      grower: grower as { name: string; is_verified: boolean } | null,
      story: (logs ?? []) as GrowthLog[],
    };
  }
);
