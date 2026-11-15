import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for pure logic (lib/ and component helpers), plus the database
 * rule tests in supabase/tests — those run every migration on an in-process
 * Postgres, so no server or network is needed.
 */
export default defineConfig({
  resolve: {
    // Same "@/…" alias as tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts", "supabase/**/*.test.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
