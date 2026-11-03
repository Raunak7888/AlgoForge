import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Analysis.tsx", () => {
  const source = readFileSync(resolve(__dirname, "../../components/DashBoard/Analysis.tsx"), "utf8");

  it("imports analysis types from the contracts package", () => {
    expect(source).toContain('from "@algoforge/contracts"');
  });

  it("declares none of the shared analysis types locally", () => {
    for (const name of ["ComplexityResult", "Breakdown", "Bottleneck", "Improvement", "Comparison", "AnalysisResult", "Analysis"]) {
      expect(source).not.toMatch(new RegExp(`export interface ${name}\\b`));
    }
    expect(source).not.toMatch(/export type Language\s*=\s*"python"/);
  });
});
