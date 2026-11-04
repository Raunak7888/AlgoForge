import { describe, expect, it } from "vitest";
import { serializeVisualization, serializeVisualizationSummary } from "./visualization";

const row = {
  id: "v1",
  title: "Demo",
  description: null,
  language: "javascript",
  structures: [{ id: "A", ds: "array", label: "Array" }],
  stepCount: 2,
  schemaVersion: 1,
  forkedFromId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: "2026-01-02T00:00:00.000Z",
  script: "[]",
  code: null,
  userId: "someone-else",
};

describe("visualization serializers", () => {
  it("maps a row and never leaks the owner", () => {
    const out = serializeVisualization(row);
    expect(out.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(out.structures).toHaveLength(1);
    expect("userId" in out).toBe(false);
  });

  it("degrades unreadable stored JSON instead of throwing", () => {
    const out = serializeVisualizationSummary({ ...row, structures: "garbage", language: "cobol" });
    expect(out.structures).toEqual([]);
    expect(out.language).toBeNull();
  });
});
