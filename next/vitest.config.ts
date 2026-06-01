import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Convention: unit tests in src/ (*.test.ts), E2E in tests/ (*.spec.ts via Playwright)
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["tests/**", "node_modules/**"],
    environment: "node",
    coverage: {
      provider: "@vitest/coverage-v8",
      thresholds: {
        lines: 60,
        functions: 60,
      },
    },
  },
});
