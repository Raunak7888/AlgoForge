import { describe, expect, it } from "vitest";
import { LIMITS } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import {
  parseCreateVisualization,
  parseListVisualizationsQuery,
  parseUpdateVisualization,
  parseVisualizationId,
} from "./visualization";

describe("visualization validation", () => {
  it("accepts a create body at the size limit and rejects one above it", () => {
    expect(parseCreateVisualization({ title: "t", script: "x".repeat(LIMITS.script.maxChars) }).title).toBe("t");
    expect(() => parseCreateVisualization({ title: "t", script: "x".repeat(LIMITS.script.maxChars + 1) })).toThrow(AppError);
  });

  it("requires at least one field to update, and lets null clear one", () => {
    expect(() => parseUpdateVisualization({})).toThrow(AppError);
    expect(parseUpdateVisualization({ description: null }).description).toBeNull();
  });

  it("validates ids and list queries", () => {
    expect(parseVisualizationId("seed_viz_1")).toBe("seed_viz_1");
    expect(() => parseVisualizationId("../etc")).toThrow(AppError);
    expect(parseListVisualizationsQuery({}).limit).toBe(LIMITS.pagination.visualizations.defaultSize);
    expect(() => parseListVisualizationsQuery({ limit: "1000" })).toThrow(AppError);
  });
});
