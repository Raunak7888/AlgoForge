import { describe, expect, it } from "vitest";
import { toGeminiRequest } from "./gemini-messages";

describe("toGeminiRequest", () => {
  it("moves system messages into systemInstruction and maps assistant to model", () => {
    const r = toGeminiRequest([
      { role: "system", content: "rules" },
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ]);
    expect(r.systemInstruction).toBe("rules");
    expect(r.contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(r.contents[1].parts[0].text).toBe("a1");
  });

  it("merges neighbours with the same role and drops a leading model turn", () => {
    const r = toGeminiRequest([
      { role: "assistant", content: "orphan" },
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ]);
    expect(r.contents).toHaveLength(1);
    expect(r.contents[0].parts[0].text).toBe("a\n\nb");
  });

  it("omits systemInstruction when there is none (analysis prompts are one user turn)", () => {
    const r = toGeminiRequest([{ role: "user", content: "only" }]);
    expect("systemInstruction" in r).toBe(false);
    expect(r.contents).toEqual([{ role: "user", parts: [{ text: "only" }] }]);
  });
});
