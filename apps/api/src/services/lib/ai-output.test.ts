import { describe, expect, it } from "vitest";
import { AppError } from "../../utils/app-error";
import { parseAnalysisOutput, sanitizeJson } from "./ai-output";

const valid = {
  summary: "s",
  complexity: { time: { best: "O(1)", average: "O(n)", worst: "O(n)" }, space: "O(1)" },
  breakdown: { approach: "a", steps: ["one"] },
  bottlenecks: [],
  antiPatterns: [],
  improvements: [],
  optimizedCode: "x",
  edgeCases: [],
};

describe("parseAnalysisOutput", () => {
  it("parses plain and fenced JSON", () => {
    expect(parseAnalysisOutput(JSON.stringify(valid)).summary).toBe("s");
    expect(parseAnalysisOutput("```json\n" + JSON.stringify(valid) + "\n```").summary).toBe("s");
    expect(sanitizeJson("noise {\"a\":1} tail")).toBe('{"a":1}');
  });

  it("reports text that is not JSON as AI_INVALID_OUTPUT", () => {
    try {
      parseAnalysisOutput("sorry, I cannot do that");
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe("AI_INVALID_OUTPUT");
    }
  });

  it("reports a wrong shape as AI_INVALID_OUTPUT", () => {
    expect(() => parseAnalysisOutput(JSON.stringify({ summary: "only" }))).toThrow(AppError);
  });
});
