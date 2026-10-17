import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The real-console smoke test lives in tests/smoke.integration.ts and is run by hand.
  },
});
