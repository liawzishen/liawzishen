// Deprecated path. The satellite endpoint moved to /api/satellite
// (provider-neutral, now backed by MapTiler). This thin re-export is kept only
// because this sandbox cannot delete files — it's safe to delete the
// `app/api/mapbox` folder in your editor.
import { POST as satellite } from "@/app/api/satellite/route";

export const POST = satellite;
