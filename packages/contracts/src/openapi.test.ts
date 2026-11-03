import { describe, expect, it } from "vitest";
import { SCHEMA_REGISTRY, buildOpenApiDocument, routes } from "./index";

function collectRefs(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) node.forEach((n) => collectRefs(n, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "$ref" && typeof v === "string") out.add(v);
      else collectRefs(v, out);
    }
  }
}

describe("OpenAPI document", () => {
  const doc = buildOpenApiDocument({ serverUrl: "http://localhost:4000" });

  it("describes every route exactly once", () => {
    const keys = routes.map((r) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(routes.map((r) => r.id)).size).toBe(routes.length);
    for (const r of routes) expect(doc.paths[r.path]?.[r.method]).toBeDefined();
  });

  it("is version 3.1 and JSON serializable", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(() => JSON.stringify(doc)).not.toThrow();
  });

  it("resolves every $ref against components.schemas", () => {
    const refs = new Set<string>();
    collectRefs(doc.paths, refs);
    const schemas = (doc.components.schemas ?? {}) as Record<string, unknown>;
    expect(Object.keys(schemas).sort()).toEqual(Object.keys(SCHEMA_REGISTRY).sort());
    for (const ref of refs) {
      expect(ref.startsWith("#/components/schemas/")).toBe(true);
      expect(schemas[ref.replace("#/components/schemas/", "")]).toBeDefined();
    }
  });

  it("documents the standard error responses and request id header", () => {
    const op = doc.paths["/api/analysis"]?.post as { responses: Record<string, { headers?: Record<string, unknown> }> };
    for (const status of ["201", "400", "401", "403", "413", "429", "500"]) expect(op.responses[status]).toBeDefined();
    expect(op.responses["201"]?.headers?.["X-Request-Id"]).toBeDefined();
    expect(op.responses["429"]?.headers?.["Retry-After"]).toBeDefined();
  });
});
