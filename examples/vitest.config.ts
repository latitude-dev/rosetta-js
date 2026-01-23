import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Import rosetta-ai from source, no need to rebuild
      "rosetta-ai": path.resolve(__dirname, "../src/index.ts"),
      $package: path.resolve(__dirname, "../src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
