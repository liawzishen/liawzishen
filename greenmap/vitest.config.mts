import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests for the pure logic in lib/ (no browser, no database). */
export default defineConfig({
  resolve: {
    // Same "@/…" alias as tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
