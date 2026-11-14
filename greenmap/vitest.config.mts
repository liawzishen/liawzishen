import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests for pure logic (no browser, no database): lib/ and component helpers. */
export default defineConfig({
  resolve: {
    // Same "@/…" alias as tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
