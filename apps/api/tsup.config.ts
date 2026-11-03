import { defineConfig } from "tsup";

// The API is bundled into one file. Workspace packages (@algoforge/*) export
// TypeScript source, so they are inlined. Everything listed in this package's
// "dependencies" (express, zod, @prisma/client, ...) stays external.
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: false,
  splitting: false,
  minify: false,
  noExternal: [/^@algoforge\//],
});
