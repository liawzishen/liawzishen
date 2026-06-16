/**
 * Shared app types.
 * Full database row types (farms, plants, growth_logs, …) arrive in Phase 2
 * together with the SQL migration — see docs/03_BACKEND_TRUTH.md.
 */

export type Role = "grower" | "consumer";

/** Shape of the metadata we store on auth.users at registration. */
export interface AppUserMetadata {
  name?: string;
  role?: Role;
}
