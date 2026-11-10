// Phase 0b: the shared size gate behaves the same wherever it is used.
import { describe, expect, it } from "vitest";
import { checkRunnableCode, countLines, LIMITS } from "@algoforge/contracts";
import { parseAnalysisInput } from "./analysis";

const MAX = LIMITS.code.runMaxLines;
const block = (n: number) => Array.from({ length: n }, (_, i) => `const v${i} = ${i};`).join("\n");

describe("runnable code gate", () => {
  it("accepts exactly the line limit", () => {
    expect(checkRunnableCode(block(MAX)).ok).toBe(true);
  });

  it("rejects one line over the limit", () => {
    const r = checkRunnableCode(block(MAX + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_many_lines");
  });

  it("counts CRLF like LF and ignores surrounding blank lines", () => {
    expect(countLines(block(3).replace(/\n/g, "\r\n"))).toBe(3);
    expect(countLines("\n\n" + block(3) + "\n\n")).toBe(3);
  });

  it("rejects empty and whitespace-only code", () => {
    for (const code of ["", "   ", "\n\n\t\n"]) {
      const r = checkRunnableCode(code);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("empty");
    }
  });

  it("rejects one huge line", () => {
    const r = checkRunnableCode("a".repeat(LIMITS.code.runMaxChars + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_long");
  });

  it("the API schema agrees with the shared check", () => {
    expect(() => parseAnalysisInput({ code: block(MAX), language: "javascript" })).not.toThrow();
    expect(() => parseAnalysisInput({ code: block(MAX + 1), language: "javascript" })).toThrow();
    expect(() => parseAnalysisInput({ code: "a".repeat(LIMITS.code.runMaxChars + 1), language: "javascript" })).toThrow();
  });
});
