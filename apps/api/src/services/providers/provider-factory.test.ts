import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", () => ({
  env: { isProduction: false, geminiApiKey: "test-key", ai: { model: "test-model" } },
}));

import { getAIProvider } from "./provider-factory";

// Built from pieces so this file does not match its own search.
const REMOVED = new RegExp("open" + "router", "i");
const REMOVED_SDK = "open" + "ai";

const cwd = process.cwd();
const API_ROOT = existsSync(join(cwd, "src")) ? cwd : join(cwd, "apps", "api");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === "dist") return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("AI provider", () => {
  it("is Gemini, and only Gemini", () => {
    const provider = getAIProvider();
    expect(provider.name).toBe("gemini");
    expect(getAIProvider()).toBe(provider);
  });

  it("has no removed-provider code in the API source", () => {
    const offenders = walk(join(API_ROOT, "src"))
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => REMOVED.test(f) || REMOVED.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("does not depend on the removed provider or its SDK", () => {
    const pkg = JSON.parse(readFileSync(join(API_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
    expect(names.filter((n) => REMOVED.test(n) || n === REMOVED_SDK)).toEqual([]);
  });
});
