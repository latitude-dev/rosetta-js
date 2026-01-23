import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      $package: path.resolve(__dirname, "src"),
    },
  },
  test: {
    // Enable globals for describe, it, expect without imports
    globals: true,

    // Use the default test environment (node)
    environment: "node",

    // Include patterns for test files
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],

    // Exclude patterns
    exclude: ["node_modules", "dist", "examples"],

    // Don't fail when no tests are found (useful during initial setup)
    passWithNoTests: true,

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/index.ts"],
    },

    // Type checking for tests
    typecheck: {
      enabled: true,
    },
  },
});
