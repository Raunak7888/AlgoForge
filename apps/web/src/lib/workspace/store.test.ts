import { beforeEach, describe, expect, it } from "vitest";
import { STARTER_CODE, useWorkspace } from "./store";

const result = {
  summary: "s",
  complexity: { time: { best: "O(1)", average: "O(n)", worst: "O(n)" }, space: "O(1)" },
  breakdown: { approach: "a", steps: ["x"] },
  bottlenecks: [],
  antiPatterns: [],
  improvements: [],
  optimizedCode: "x",
  edgeCases: [],
};

beforeEach(() => useWorkspace.getState().reset());

describe("workspace store", () => {
  it("keeps the code of each language separate", () => {
    const s = useWorkspace.getState();
    s.setCode("let js = 1");
    s.setLanguage("python");
    expect(useWorkspace.getState().codes.python).toBe(STARTER_CODE.python);
    useWorkspace.getState().setCode("py = 1");
    useWorkspace.getState().setLanguage("javascript");
    expect(useWorkspace.getState().codes.javascript).toBe("let js = 1");
  });

  it("restores code, language and result when an analysis is opened", () => {
    useWorkspace.getState().openAnalysis({ id: "a1", code: "print(1)", language: "python", result, title: "T" });
    const s = useWorkspace.getState();
    expect(s.language).toBe("python");
    expect(s.codes.python).toBe("print(1)");
    expect(s.run).toMatchObject({ status: "completed", analysisId: "a1", unreadable: false, title: "T" });
    expect(s.lastOpenedId).toBe("a1");
  });

  it("marks an analysis with an unreadable result but still restores its code", () => {
    useWorkspace.getState().openAnalysis({ id: "a2", code: "x", language: "javascript", result: null, title: null });
    expect(useWorkspace.getState().run.unreadable).toBe(true);
    expect(useWorkspace.getState().codes.javascript).toBe("x");
  });

  it("tracks a run from start to failure and back to idle", () => {
    const s = useWorkspace.getState();
    s.startRun();
    expect(useWorkspace.getState().run.status).toBe("running");
    useWorkspace.getState().failRun({ message: "limit", code: "QUOTA_EXCEEDED", retryAt: 123 });
    expect(useWorkspace.getState().run).toMatchObject({ status: "error", error: "limit", retryAt: 123 });
    useWorkspace.getState().resetRun();
    expect(useWorkspace.getState().run.status).toBe("idle");
  });

  it("forgets a deleted analysis", () => {
    useWorkspace.getState().openAnalysis({ id: "a3", code: "x", language: "python", result, title: null });
    useWorkspace.getState().forgetAnalysis("a3");
    expect(useWorkspace.getState().run.status).toBe("idle");
    expect(useWorkspace.getState().lastOpenedId).toBeNull();
  });
});
