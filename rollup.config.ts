import path from "node:path";
import { fileURLToPath } from "node:url";
import alias from "@rollup/plugin-alias";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";
import dts from "rollup-plugin-dts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const external = ["zod", "url"];

const aliasPlugin = alias({
  entries: [{ find: "$package", replacement: path.resolve(__dirname, "src") }],
});

export default defineConfig([
  // ESM build
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "esm",
      sourcemap: true,
    },
    external,
    plugins: [
      aliasPlugin,
      resolve(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        declarationMap: false,
        sourceMap: true,
      }),
    ],
  },
  // CJS build
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external,
    plugins: [
      aliasPlugin,
      resolve(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        declarationMap: false,
        sourceMap: true,
      }),
    ],
  },
  // TypeScript declarations (ESM)
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.ts",
      format: "esm",
    },
    external,
    plugins: [aliasPlugin, dts()],
  },
  // TypeScript declarations (CJS)
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.cts",
      format: "cjs",
    },
    external,
    plugins: [aliasPlugin, dts()],
  },
]);
