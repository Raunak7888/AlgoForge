import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { JSON_BODY_LIMIT_BYTES, LIMITS, routes, toExpressPath } from "@algoforge/contracts";

const SRC = resolve(__dirname, "..");

/** Mount point of every router in app.ts. A new router file must be added here and to the contracts. */
const MOUNTS: Readonly<Record<string, string>> = {
  "health.ts": "",
  "auth.ts": "/api/auth",
  "algorithm.ts": "/api/algorithms",
  "category.ts": "/api/categories",
  "analysis.ts": "/api/analysis",
  "explanation.ts": "/api/explain",
  "explanation-session.ts": "/api/explain-sessions",
  "share.ts": "/api/share",
  "admin.ts": "/api/admin",
};

function implemented(): string[] {
  const found: string[] = [];
  for (const [file, mount] of Object.entries(MOUNTS)) {
    const text = readFileSync(join(SRC, "routes", file), "utf8");
    for (const m of text.matchAll(/router\s*\.\s*(get|post|patch|delete)\s*\(\s*"([^"]*)"/g)) {
      const path = m[2] === "/" ? mount : mount + m[2];
      found.push(`${m[1]} ${path}`);
    }
  }
  return found.sort();
}

describe("contracts route table", () => {
  it("lists exactly the endpoints the Express routers serve", () => {
    const documented = routes.map((r) => `${r.method} ${toExpressPath(r.path)}`).sort();
    expect(implemented()).toEqual(documented);
  });
});

describe("shared limits are wired in", () => {
  it("app.ts uses the shared body limit instead of a literal", () => {
    const app = readFileSync(join(SRC, "app.ts"), "utf8");
    expect(app).toContain("JSON_BODY_LIMIT_BYTES");
    expect(app).not.toMatch(/limit:\s*"\d+kb"/i);
  });
  it("keeps the body limit above the largest escaped payload", () => {
    expect(JSON_BODY_LIMIT_BYTES).toBeGreaterThan(LIMITS.code.maxChars * 4);
  });
  it("no validator hard-codes the page sizes or code size", () => {
    for (const file of ["validation/analysis.ts", "validation/explanation-session.ts"]) {
      const text = readFileSync(join(SRC, file), "utf8");
      expect(text).not.toMatch(/MAX_PAGE_SIZE\s*=\s*\d+/);
      expect(text).not.toMatch(/max\(\s*\d{2,}/);
    }
  });
});
